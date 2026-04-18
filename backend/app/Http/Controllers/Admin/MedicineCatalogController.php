<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master TCM medicine catalogue — source of truth for drug names and
 * prices across all pharmacies. Seeded from Timing Herbs SDN. BHD.
 * monthly price list (单方 + 复方 浓缩细粒).
 *
 * The table is pharmacy-agnostic. Individual pharmacies still maintain
 * their own `products` rows with stock levels; the catalogue provides
 * the canonical list of names + reference prices.
 */
class MedicineCatalogController extends Controller
{
    /** Create the table if it doesn't already exist. Idempotent. */
    public function migrate(Request $request)
    {
        $log = [];
        $errors = [];

        if (! Schema::hasTable('medicine_catalog')) {
            try {
                DB::statement("
                    CREATE TABLE medicine_catalog (
                        id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        code          VARCHAR(20) NOT NULL UNIQUE,
                        name_zh       VARCHAR(120) NOT NULL,
                        name_pinyin   VARCHAR(160) NOT NULL,
                        type          ENUM('single','compound') NOT NULL,
                        category      VARCHAR(10) NULL,
                        unit          VARCHAR(20) NOT NULL DEFAULT 'per 100g',
                        pack_grams    DECIMAL(10,2) NOT NULL DEFAULT 100,
                        unit_price    DECIMAL(10,2) NULL,
                        source        VARCHAR(80) NOT NULL DEFAULT 'Timing Herbs',
                        price_month   VARCHAR(20) NULL,
                        is_active     TINYINT(1) NOT NULL DEFAULT 1,
                        notes         TEXT NULL,
                        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        KEY idx_mc_type (type, is_active),
                        KEY idx_mc_name (name_zh)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ");
                $log[] = 'created table medicine_catalog';
            } catch (\Throwable $e) {
                $errors[] = 'create table: ' . $e->getMessage();
            }
        } else {
            $log[] = 'medicine_catalog already exists, skipped';
            // Backfill pack_grams column for existing installs
            if (! Schema::hasColumn('medicine_catalog', 'pack_grams')) {
                try {
                    DB::statement("ALTER TABLE medicine_catalog ADD COLUMN pack_grams DECIMAL(10,2) NOT NULL DEFAULT 100 AFTER unit");
                    // Existing rows had prices labelled "per 100g" — seed pack_grams=100 for them.
                    DB::statement("UPDATE medicine_catalog SET pack_grams = 100 WHERE pack_grams IS NULL OR pack_grams = 0");
                    $log[] = 'added column pack_grams (default 100)';
                } catch (\Throwable $e) {
                    $errors[] = 'add pack_grams: ' . $e->getMessage();
                }
            } else {
                $log[] = 'column pack_grams already exists, skipped';
            }
        }

        return response()->json([
            'success' => empty($errors),
            'log'     => $log,
            'errors'  => $errors,
        ]);
    }

    /**
     * Seed (or upsert) the Timing Herbs Mar-2026 price list.
     * Safe to run multiple times — upserts on `code`.
     */
    public function seed(Request $request)
    {
        if (! Schema::hasTable('medicine_catalog')) {
            return response()->json([
                'success' => false,
                'errors'  => ['Run /admin/migrations/medicine-catalog first to create the table.'],
            ], 400);
        }

        $singles   = $this->singleHerbs();
        $compounds = $this->compoundFormulas();
        $month     = '2026-03';
        $inserted  = 0;
        $updated   = 0;

        foreach ($singles as $row) {
            [$code, $zh, $py, $price] = $row;
            $priceVal = is_numeric($price) ? (float)$price : null;
            $existing = DB::table('medicine_catalog')->where('code', $code)->first();
            $data = [
                'code'        => $code,
                'name_zh'     => $zh,
                'name_pinyin' => $py,
                'type'        => 'single',
                'category'    => substr($py, 0, 1),
                'unit'        => 'per 100g',
                'unit_price'  => $priceVal,
                'source'      => 'Timing Herbs',
                'price_month' => $month,
                'is_active'   => 1,
                'notes'       => $priceVal === null ? '询价 — contact supplier for current price' : null,
                'updated_at'  => now(),
            ];
            if ($existing) {
                DB::table('medicine_catalog')->where('id', $existing->id)->update($data);
                $updated++;
            } else {
                $data['created_at'] = now();
                DB::table('medicine_catalog')->insert($data);
                $inserted++;
            }
        }

        foreach ($compounds as $row) {
            [$code, $zh, $py, $price] = $row;
            $priceVal = is_numeric($price) ? (float)$price : null;
            $existing = DB::table('medicine_catalog')->where('code', $code)->first();
            $data = [
                'code'        => $code,
                'name_zh'     => $zh,
                'name_pinyin' => $py,
                'type'        => 'compound',
                'category'    => substr($code, 0, 1),
                'unit'        => 'per 100g',
                'unit_price'  => $priceVal,
                'source'      => 'Timing Herbs',
                'price_month' => $month,
                'is_active'   => 1,
                'notes'       => $priceVal === null ? '询价 — contact supplier for current price' : null,
                'updated_at'  => now(),
            ];
            if ($existing) {
                DB::table('medicine_catalog')->where('id', $existing->id)->update($data);
                $updated++;
            } else {
                $data['created_at'] = now();
                DB::table('medicine_catalog')->insert($data);
                $inserted++;
            }
        }

        return response()->json([
            'success'       => true,
            'total_rows'    => count($singles) + count($compounds),
            'singles_count' => count($singles),
            'formulas_count'=> count($compounds),
            'inserted'      => $inserted,
            'updated'       => $updated,
            'month'         => $month,
        ]);
    }

    /** List catalogue entries (optionally filtered). Returns active+inactive. */
    public function index(Request $request)
    {
        if (! Schema::hasTable('medicine_catalog')) {
            return response()->json(['data' => [], 'total' => 0]);
        }
        $q = DB::table('medicine_catalog');
        if ($request->query('active_only')) $q->where('is_active', 1);
        if ($type = $request->query('type'))     $q->where('type', $type);
        if ($search = $request->query('q')) {
            $q->where(function ($w) use ($search) {
                $w->where('name_zh', 'like', "%{$search}%")
                  ->orWhere('name_pinyin', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }
        $rows = $q->orderBy('type')->orderBy('name_pinyin')->limit(2000)->get();
        return response()->json(['data' => $rows, 'total' => $rows->count()]);
    }

    /** Create a single medicine row (manual entry outside the bulk seeder). */
    public function store(Request $request)
    {
        $this->ensureTable();
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20', 'unique:medicine_catalog,code'],
            'name_zh'     => ['required', 'string', 'max:120'],
            'name_pinyin' => ['required', 'string', 'max:160'],
            'type'        => ['required', 'in:single,compound'],
            'unit'        => ['nullable', 'string', 'max:20'],
            'pack_grams'  => ['nullable', 'numeric', 'min:0.01'],
            'unit_price'  => ['nullable', 'numeric', 'min:0'],
            'notes'       => ['nullable', 'string', 'max:1000'],
            'is_active'   => ['nullable', 'boolean'],
        ]);
        $data['source']      = $data['source']      ?? 'Manual';
        $data['category']    = substr($data['name_pinyin'], 0, 1);
        $data['pack_grams']  = $data['pack_grams']  ?? 100;
        $data['unit']        = $data['unit']        ?? ('per ' . ((int) $data['pack_grams']) . 'g');
        $data['is_active']   = $data['is_active']   ?? 1;
        $data['created_at']  = now();
        $data['updated_at']  = now();
        $id = DB::table('medicine_catalog')->insertGetId($data);
        return response()->json(['id' => $id, 'data' => $data], 201);
    }

    /** Update a medicine row by id. */
    public function update(Request $request, int $id)
    {
        $this->ensureTable();
        $data = $request->validate([
            'code'        => ['nullable', 'string', 'max:20'],
            'name_zh'     => ['nullable', 'string', 'max:120'],
            'name_pinyin' => ['nullable', 'string', 'max:160'],
            'type'        => ['nullable', 'in:single,compound'],
            'unit'        => ['nullable', 'string', 'max:20'],
            'pack_grams'  => ['nullable', 'numeric', 'min:0.01'],
            'unit_price'  => ['nullable', 'numeric', 'min:0'],
            'notes'       => ['nullable', 'string', 'max:1000'],
            'is_active'   => ['nullable', 'boolean'],
        ]);

        $existing = DB::table('medicine_catalog')->where('id', $id)->first();
        if (! $existing) return response()->json(['message' => 'Not found'], 404);

        // Block code collisions
        if (!empty($data['code']) && $data['code'] !== $existing->code) {
            if (DB::table('medicine_catalog')->where('code', $data['code'])->where('id', '!=', $id)->exists()) {
                return response()->json(['errors' => ['code' => ['Code already in use']]], 422);
            }
        }

        $data = array_filter($data, fn($v) => $v !== null);
        if (!empty($data['name_pinyin'])) $data['category'] = substr($data['name_pinyin'], 0, 1);
        $data['updated_at'] = now();

        DB::table('medicine_catalog')->where('id', $id)->update($data);
        return response()->json(['data' => DB::table('medicine_catalog')->where('id', $id)->first()]);
    }

    /** Soft-delete = set is_active=0. Hard-delete via ?force=1. */
    public function destroy(Request $request, int $id)
    {
        $this->ensureTable();
        if ($request->query('force')) {
            DB::table('medicine_catalog')->where('id', $id)->delete();
            return response()->json(['deleted' => true, 'hard' => true]);
        }
        DB::table('medicine_catalog')->where('id', $id)->update([
            'is_active' => 0,
            'updated_at' => now(),
        ]);
        return response()->json(['deleted' => true, 'hard' => false]);
    }

    private function ensureTable(): void
    {
        if (! Schema::hasTable('medicine_catalog')) {
            abort(response()->json(['message' => 'medicine_catalog table missing — run the migrate step first.'], 400));
        }
    }

    /**
     * Timing Herbs Mar-2026 单方 (single herb) price list.
     * [code, 中文, Pinyin, price_MYR_per_100g or '询' for inquire]
     */
    private function singleHerbs(): array
    {
        return [
            ['5610','艾叶','Ai Ye',47],
            ['5416','巴戟天','Ba Ji Tian',70],
            ['5502','白花蛇舌草','Bai Hua She She Cao',60],
            ['5503','白芨','Bai Ji',290],
            ['5504','白朮','Bai Zhu',68],
            ['5505','白芷','Bai Zhi',45],
            ['5507','白茅根','Bai Mao Gen',50],
            ['5509','白芍药','Bai Shao Yao',55],
            ['5514','北沙参','Bei Sha Shen',60],
            ['5518','半夏','Ban Xia',110],
            ['5523','白鲜皮','Bai Xian Pi',78],
            ['5524','白芥子','Bai Jie Zi',43],
            ['5525','半枝莲','Ban Zhi Lian',45],
            ['5601','百合','Bai He',72],
            ['5612','百部','Bai Bu',46],
            ['5803','板蓝根','Ban Lan Gen',58],
            ['5909','柏子仁','Bai Zi Ren',70],
            ['6105','败酱','Bai Jiang',40],
            ['6234','萆薢','Bei Xie',52],
            ['6306','补骨脂','Bu Gu Zhi',50],
            ['6702','薄荷','Bo He',54],
            ['6704','白殭蚕','Bai Jiang Can',148],
            ['6802','槟榔','Bing Lang','询'],
            ['5302','川七','Chuan Qi',210],
            ['5303','川芎','Chuan Xiong',51],
            ['5304','川楝子','Chuan Lian Zi',47],
            ['5404','川牛膝','Chuan Niu Xi',50],
            ['5703','车前子','Che Qian Zi',54],
            ['5709','赤芍','Chi Shao',50],
            ['5710','赤小豆','Chi Xiao Dou','询'],
            ['5817','刺五加','Ci Wu Jia',62],
            ['5903','柴胡','Chai Hu',78],
            ['6110','陈皮','Chen Pi',44],
            ['6305','葱白','Cong Bai',40],
            ['6402','苍朮','Cang Zhu',76],
            ['6403','苍耳子','Cang Er Zi',48],
            ['6801','蝉蜕','Chan Tuei',230],
            ['5201','丁香','Ding Xiang',50],
            ['5307','大黄','Da Huang',48],
            ['5310','大腹皮','Da Fu Pi',48],
            ['5311','大青叶','Da Qing Ye',35],
            ['5319','大枣','Da Zao',34],
            ['5412','丹参','Dan Shen',49],
            ['5604','地龙','Di Long',168],
            ['5605','地骨皮','Di Gu Pi',75],
            ['5606','地肤子','Di Fu Zi',54],
            ['5714','杜仲','Du Zhong',88],
            ['6119','淡竹叶','Dan Zhu Ye',48],
            ['6302','当归','Dang Gui',80],
            ['6605','独活','Du Huo',44],
            ['7003','党参','Dang Shen',100],
            ['5806','阿胶','E Jiao',238],
            ['6109','莪朮','E Zhu',38],
            ['6805','鵝不食草','E Bu Shi Cao',50],
            ['5711','防风','Fang Feng',150],
            ['5802','佛手柑','Fo Shou Gan',70],
            ['6005','茯神','Fu Shen',60],
            ['6006','茯苓','Fu Ling',49],
            ['6024','浮小麦','Fu Xiao Mai',47],
            ['6230','番泻叶','Fan Xie Ye',47],
            ['6804','覆盆子','Fu Pen Zi',128],
            ['5519','甘草','Gan Cao',47],
            ['5718','榖精草','Gu Jung Cao',80],
            ['5813','狗脊','Gou Ji',58],
            ['5910','枸杞子','Gou Qi Zi',45],
            ['6002','骨碎补','Gu Sui Bu',55],
            ['6010','桂枝','Gui Zhi',52],
            ['6019','栝楼仁','Gua Lou Ren',51],
            ['6025','栝楼实','Gua Lou Shi',65],
            ['6027','高良姜','Gao Liang Jiang','询'],
            ['6104','干姜','Gan Jiang',46],
            ['6210','钩藤','Gou Teng',78],
            ['6304','葛根','Ge Gen',45],
            ['6408','藁本','Gao Ben',50],
            ['5603','合欢皮','He Huan Pi',49],
            ['5702','何首乌','He Shou Wu',44],
            ['5715','旱莲草','Han Lian Cao',48],
            ['5816','虎杖','Hu Zhang',40],
            ['5907','红花','Hong Hua',150],
            ['5915','红景天','Hong Jing Tian',70],
            ['6016','海螵蛸','Hai Piao Xiao',56],
            ['6118','荷叶','He Ye',54],
            ['6201','黄柏','Huang Bo',55],
            ['6202','黄连','Huang Lian',208],
            ['6203','黄耆','Huang Qi',52],
            ['6204','黄精','Huang Jing',62],
            ['6206','黄芩','Huang Qin',47],
            ['6207','诃子','He Zi',45],
            ['6301','滑石','Hua Shi',45],
            ['7004','藿香','Huo Xiang',45],
            ['1201','绞股蓝','Jiao Gu Lan',58],
            ['5701','决明子(草)','Jue Ming Zi',50],
            ['5811','金钱草','Jin Qian Cao',49],
            ['5812','金银花','Jin Yin Hua',150],
            ['5916','韭菜籽','Jiu Cai Zi',68],
            ['6008','荆芥','Jing Jie',51],
            ['6009','桔梗','Jie Geng',59],
            ['6208','菊花','Ju Hua',88],
            ['6411','蒺藜','Ji Li',50],
            ['6703','姜黄','Jiang Huang',50],
            ['6902','鸡血藤','Ji Xue Teng',45],
            ['6903','鸡内金','Ji Nei Jin',70],
            ['5905','苦参根','Ku Shen Gen',45],
            ['6209','款冬花','Kuan Dong Hua',98],
            ['6103','连翘','Lian Qiao',87],
            ['6231','莱菔子','Lai Fu Zi',48],
            ['6308','路路通','Lu Lu Tong',49],
            ['6607','龙骨','Long Gu',46],
            ['6608','龙胆','Long Dan',72],
            ['7005','芦根','Lu Gen',45],
            ['5405','木瓜','Mu Gua',45],
            ['5407','木香','Mu Xiang',47],
            ['5422','木贼','Mu Zei',43],
            ['5705','牡蛎','Mu Li',46],
            ['5706','牡丹皮','Mu Dan Pi',57],
            ['5708','没药','Mo Yao',60],
            ['5721','芒硝','Mang Xiao',50],
            ['6107','麦芽','Mai Ya',44],
            ['6108','麦门冬','Mai Men Dong',75],
            ['6503','蔓荆子','Man Jing Zi',88],
            ['5316','女贞子','Nv Zhen Zi',45],
            ['5402','牛蒡子','Niu Bang Zi',60],
            ['5403','牛膝(怀)','Niu Xi (Huai)',45],
            ['5814','枇杷叶','Pi Pa Ye',46],
            ['5820','佩兰','Pei Lan',40],
            ['6404','蒲公英','Pu Gong Ying',47],
            ['6410','蒲黄','Pu Huang',78],
            ['5808','青皮','Qing Pi',46],
            ['5809','青蒿','Qing Hao',45],
            ['5815','羌活','Qiang Huo',140],
            ['5822','芡实','Qian Shi',48],
            ['5904','前胡','Qian Hu',52],
            ['6015','秦艽','Qin Jiao',76],
            ['6030','茜草根','Qian Cao Gen','询'],
            ['5607','肉豆蔻','Rou Dou Kou',78],
            ['5608','肉苁蓉','Rou Cong Rong',118],
            ['5609','肉桂','Rou Gui',56],
            ['5722','忍冬藤','Ren Dong Teng',45],
            ['5807','乳香','Ru Xiang',49],
            ['5301','三棱','San Leng','询'],
            ['5312','山药','Shan Yao',40],
            ['5313','山楂','Shan Zha',47],
            ['5315','山茱萸','Shan Zhu Yu',75],
            ['5408','升麻','Sheng Ma',72],
            ['5510','石膏','Shi Gao',43],
            ['5511','石斛','Shi Hu',150],
            ['5512','石决明','Shi Jue Ming',47],
            ['5513','石菖蒲','Shi Chang Pu',72],
            ['5516','生姜','Sheng Jiang',50],
            ['5517','生地黄','Sheng Di Huang',40],
            ['5716','伸筋草','Shen Jin Cao',48],
            ['5906','砂仁','Sha Ren',91],
            ['6001','神曲','Shen Qu',70],
            ['6003','射干','She Gan',50],
            ['6013','桑白皮','Sang Bai Pi',46],
            ['6014','桑寄生','Sang Ji Sheng',50],
            ['6020','山栀子','Shan Zhi Zi',55],
            ['6021','桑叶','Sang Ye',47],
            ['6023','桑枝','Sang Zhi',49],
            ['6102','蛇床子','She Chuang Zi',55],
            ['6406','酸枣仁','Suan Zao Ren',300],
            ['6601','熟地黄','Shu Di Huang',48],
            ['6803','锁阳','Suo Yang',58],
            ['5305','土茯苓','Tu Fu Ling',54],
            ['5409','天麻','Tian Ma',156],
            ['5410','天门冬','Tian Men Dong','询'],
            ['5411','天花粉','Tian Hua Fen',51],
            ['5420','天南星','Tian Nan Xing','询'],
            ['6011','桃仁','Tao Ren',70],
            ['6031','通草','Tong Cao',100],
            ['6211','菟丝子','Tu Si Zi',52],
            ['6309','葶苈子','Ting Li Zi',44],
            ['5413','五味子','Wu Wei Zi',128],
            ['5414','五灵脂','Wu Ling Zhi',55],
            ['5415','五加皮','Wu Jia Pi',55],
            ['5801','吴茱萸','Wu Zhu Yu',200],
            ['5824','武靴叶','Wu Xue Ye',62],
            ['6004','乌药','Wu Yao',49],
            ['5306','小茴香','Xiao Hui Xiang',45],
            ['5501','玄参','Xuan Shen',48],
            ['5515','仙鹤草','Xian He Cao',50],
            ['5704','杏仁','Xing Ren',53],
            ['5707','辛夷','Xin Yi',73],
            ['5902','香附','Xiang Fu',45],
            ['6012','夏枯草','Xia Ku Cao',53],
            ['6705','薤白','Xie Bai',50],
            ['7101','續斷','Xu Duan',39],
            ['5520','玉竹','Yu Zhu',48],
            ['5528','玉米须','Yu Mi Xu',50],
            ['5805','延胡索','Yan Hu Suo',100],
            ['5810','夜交藤','Ye Jiao Teng',55],
            ['6007','茵陈(綿)','Yin Chen',55],
            ['6017','益智仁','Yi Zhi Ren',60],
            ['6018','益母草','Yi Mu Cao',50],
            ['6101','淫羊藿','Yin Yang Huo',58],
            ['6106','鱼腥草','Yu Xing Cao',49],
            ['6241','茵陈蒿','Yin Chen Hao',52],
            ['6401','远志','Yuan Zhi',62],
            ['6701','薏苡仁','Yi Yi Ren',54],
            ['7901','郁金','Yu Jin',70],
            ['5602','竹茹','Zhu Ru',52],
            ['5713','浙贝母','Zhe Bei Mu',118],
            ['5717','皀角刺','Zao Jiau Ci',72],
            ['5804','知母','Zhi Mu',40],
            ['5823','炙甘草','Zhi Gan Cao',51],
            ['5911','枳实','Zhi Shi',60],
            ['5912','枳壳','Zhi Ke',45],
            ['6113','紫苑','Zi Wan',56],
            ['6114','紫苏叶','Zi Su Ye',45],
            ['6122','紫花地丁','Zi Hua Di Ding',45],
            ['6233','紫草','Zi Cao',76],
            ['6602','茱苓','Zhu Ling',165],
            ['6603','泽兰','Ze Lan',43],
            ['6604','泽泻','Ze Xie',48],
            ['7001','紫苏子','Zi Su Zi','询'],
        ];
    }

    /**
     * Timing Herbs Mar-2026 复方 (compound formula) price list.
     * [code, 中文, Pinyin, price_MYR_per_100g]
     */
    private function compoundFormulas(): array
    {
        return [
            ['B0206','八正散','Ba Zheng San',155],
            ['B0207','八珍汤','Ba Zhen Tang',130],
            ['B0208','八味地黄丸','Ba Wei Di Huang Wan',140],
            ['B0510','白虎汤','Bai Hu Tang',130],
            ['B0512','白头翁汤','Bai Tou Weng Tang',180],
            ['B0517','半夏泻心汤','Ban Xia Xie Xin Tang',190],
            ['B0518','半夏天麻白朮汤','Ban Xia Tian Ma Bai Zhu Tang',180],
            ['B0602','百合固金汤','Bai He Gu Jin Tang',190],
            ['B0911','保和丸','Bao He Wan',145],
            ['B1308','补中益气汤','Bu Zhong Yi Qi Tang',180],
            ['B1309','补阳还五汤','Bu Yang Huan Wu Tang',150],
            ['C0301','川芎茶调散','Chuan Xiong Cha Tiao San',140],
            ['C0904','柴胡清肝汤','Chai Hu Qing Gan Tang',140],
            ['C0905','柴胡桂枝汤','Chai Hu Gui Zhi Tang',150],
            ['C0906','柴胡疏肝汤','Chai Hu Shu Gan Tang',150],
            ['C0907','柴葛解肌汤','Chai Ge Jie Ji Tang',150],
            ['C0909','柴胡加龙骨牡蛎汤','Chai Hu Jia Long Gu Mu Li Tang',160],
            ['C1401','苍耳散','Cang Er San',145],
            ['D0309','大承气汤','Da Cheng Qi Tang',130],
            ['D0310','大柴胡汤','Da Chai Hu Tang',150],
            ['D0802','定喘汤','Ding Chuan Tang',160],
            ['D0809','抵当汤','Di Dang Tang',160],
            ['D1313','当归四逆汤','Dang Gui Si Ni Tang',150],
            ['D1314','当归芍药散','Dang Gui Shao Yao San',125],
            ['D1315','当归拈痛汤','Dang Gui Nian Tong Tang',160],
            ['D1603','独活寄生汤','Du Huo Ji Sheng Tang',180],
            ['E0201','二朮汤','Er Zhu Tang',160],
            ['E0202','二陈汤','Er Chen Tang',140],
            ['F0708','防风通圣散','Fang Feng Tong Sheng San',150],
            ['F0709','防己黄耆汤','Fang Ji Huang Qi Tang',160],
            ['F0812','肥儿八珍糕','Fei Er Ba Zhen Gao',112],
            ['F1209','复元活血汤','Fu Yuan Huo Xue Tang',160],
            ['G0513','甘露饮','Gan Lu Yin',140],
            ['G0514','甘麦大枣汤','Gan Mai Da Zao Tang',130],
            ['G0515','甘露消毒饮','Gan Lu Xiao Du Yin',170],
            ['G0523','瓜蒌枳实汤','Gua Lou Zhi Shi Tang',230],
            ['G1013','桂枝汤','Gui Zhi Tang',130],
            ['G1014','桂枝茯苓丸','Gui Zhi Fu Ling Wan',140],
            ['G1015','桂枝芍药知母汤','Gui Zhi Shao Yao Zhi Mu Tang',140],
            ['G1016','桂枝加龙骨牡蛎汤','Gui Zhi Jia Long Gu Mu Li Tang',130],
            ['G1208','钩藤散','Gou Teng San',140],
            ['G1310','葛根汤','Ge Gen Tang',120],
            ['G1311','葛根芩连汤','Ge Gen Qin Lian Tang',150],
            ['G1802','归脾汤','Gui Pi Tang',180],
            ['H1202','黄连解毒汤','Huang Lian Jie Du Tang',160],
            ['H1203','黄耆建中汤','Huang Qi Jian Zhong Tang',150],
            ['H1204','黄耆五物汤','Huang Qi Wu Wu Tang',165],
            ['H1702','还少丹','Huan Shao Dan',180],
            ['H2001','藿香正气散','Huo Xiang Zheng Qi San',130],
            ['J0210','九味羌活汤','Jiu Wei Qiang Huo Tang',130],
            ['J0519','加味逍遥散','Jia Wei Xiao Yao San',150],
            ['J0804','金锁固精丸','Jin Suo Gu Jing Wan',160],
            ['J1010','荆芥连翘汤','Jing Jie Lian Qiao Tang',160],
            ['J1011','荆防败毒散','Jing Fang Bai Du San',160],
            ['J1703','济生肾气丸','Ji Sheng Shen Qi Wan',140],
            ['J2301','蠲痹汤','Juan Bi Tang',180],
            ['L0407','六君子汤','Liu Jun Zi Tang',170],
            ['L0408','六味地黄丸','Liu Wei Di Huang Wan',150],
            ['L0917','苓桂朮甘汤','Ling Gui Zhu Gan Tang',125],
            ['L1122','理中汤','Li Zhong Tang',180],
            ['L1604','龙胆泻肝汤','Long Dan Xie Gan Tang',150],
            ['M1103','麦门冬汤','Mai Men Dong Tang',150],
            ['M1115','麻杏甘石汤','Ma Xing Gan Shi Tang',150],
            ['P0505','平胃散','Ping Wei San',130],
            ['P1210','普济消毒饮','Pu Ji Xiao Du Yin',190],
            ['Q0710','杞菊地黄丸','Qi Ju Di Huang Wan',150],
            ['Q0808','羌活胜湿汤','Qiang Huo Sheng Shi Tang',180],
            ['Q1106','清鼻汤','Qing Bi Tang',130],
            ['Q1107','清心莲子饮','Qing Xin Lian Zi Yin',180],
            ['Q1109','清燥救肺汤','Qing Zao Jiu Fei Tang',190],
            ['Q1125','清气化痰丸','Qing Qi Hua Tan Wan',150],
            ['R0205','人参败毒散','Ren Shen Bai Du San',160],
            ['R1501','润肠丸','Run Chang Wan',150],
            ['S0302','三黄泻心汤','San Huang Xie Xin Tang',180],
            ['S0404','少腹逐瘀汤','Shao Fu Zhu Yu Tang',160],
            ['S0504','生脉饮','Sheng Mai Yin',195],
            ['S0506','四逆汤','Si Ni Tang',160],
            ['S0507','四逆散','Si Ni San',160],
            ['S0508','四物汤','Si Wu Tang',130],
            ['S0509','四君子汤','Si Jun Zi Tang',160],
            ['S0702','芍药甘草汤','Shao Yao Gan Cao Tang',130],
            ['S0713','身痛逐瘀汤','Shen Tong Zhu Yu Tang',160],
            ['S0716','沙参麦冬汤','Sha Shen Mai Dong Tang',140],
            ['S1003','桑菊饮','Sang Ju Yin',140],
            ['S1119','参苏饮','Shen Su Yin',130],
            ['S1120','参苓白朮散','Shen Ling Bai Zhu San',160],
            ['S1206','散肿溃坚汤','San Zhong Kui Jian Tang',140],
            ['S1306','疏经活血汤','Shu Jing Huo Xue Tang',150],
            ['S1404','酸枣仁汤','Suan Zao Ren Tang',350],
            ['T0409','天王补心丹','Tian Wang Bu Xin Dan',180],
            ['T0410','天麻钩藤饮','Tian Ma Gou Teng Yin',180],
            ['T0604','托里消毒饮','Tuo Li Xiao Du Yin',150],
            ['T1008','桃核承气汤','Tao He Cheng Qi Tang',135],
            ['T1009','桃红四物汤','Tao Hong Si Wu Tang',150],
            ['T1502','调胃承气汤','Tiao Wei Cheng Qi Tang',120],
            ['W0402','五皮饮','Wu Pi Yin',130],
            ['W0403','五淋散','Wu Lin San',160],
            ['W0404','五苓散','Wu Ling San',160],
            ['W0415','五味消毒饮','Wu Wei Xiao Du Yin',170],
            ['W1301','温胆汤','Wen Dan Tang',130],
            ['W1302','温经汤','Wen Jing Tang',200],
            ['X0305','小青龙汤','Xiao Qing Long Tang',160],
            ['X0306','小柴胡汤','Xiao Chai Hu Tang',180],
            ['X0307','小建中汤','Xiao Jian Zhong Tang',130],
            ['X0505','杏苏散','Xing Su San',140],
            ['X0524','仙方活命饮','Xian Fang Huo Ming Yin',160],
            ['X0605','血府逐瘀汤','Xue Fu Zhu Yu Tang',160],
            ['X0703','辛夷散','Xin Yi San',160],
            ['X0704','辛夷清肺汤','Xin Yi Qing Fei Tang',120],
            ['X0915','香砂六君子汤','Xiang Sha Liu Jun Zi Tang',150],
            ['X1002','消风散','Xiao Feng San',160],
            ['X1118','逍遥散','Xiao Yao San',130],
            ['X1121','旋覆代赭石汤','Xuan Fu Dai Zhe Shi Tang',150],
            ['X1803','泻白散','Xie Bai San',120],
            ['X1804','泻黄散','Xie Huang San',130],
            ['X1805','洗肝明目汤','Xi Gan Ming Mu Tang',165],
            ['X2201','响声破笛丸','Xiang Sheng Po Di Wan',130],
            ['Y0501','玉女煎','Yu Nv Jian',120],
            ['Y0502','玉屏风散','Yu Ping Feng San',150],
            ['Y0521','右归丸','You Gui Wan',180],
            ['Y0526','玉泉丸','Yu Quan Wan',150],
            ['Y1402','银翘散','Yin Qiao San',160],
            ['Y1505','养阴清肺汤','Yang Yin Qing Fei Tang',150],
            ['Z0401','止嗽散','Zhi Sou San',120],
            ['Z0520','正骨紫金丹','Zheng Gu Zi Jin Dan',140],
            ['Z0522','左归丸','Zuo Gui Wan',210],
            ['Z0805','知柏地黄丸','Zhi Bo Di Huang Wan',140],
            ['Z0806','炙甘草汤','Zhi Gan Cao Tang',160],
            ['Z1601','茱苓汤','Zhu Ling Tang',280],
        ];
    }
}
