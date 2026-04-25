<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds defensive HTTP security headers to every API response.
 *
 * Why each header:
 *   • X-Content-Type-Options: nosniff
 *       Stops browsers from MIME-sniffing JSON responses as HTML/JS.
 *   • X-Frame-Options: DENY
 *       Prevents the API from being framed (clickjacking defence).
 *       Frontend pages are on github.io and can frame normally.
 *   • Referrer-Policy: strict-origin-when-cross-origin
 *       Don't leak the full API URL to third parties.
 *   • Strict-Transport-Security: 1 year, subdomains, preload
 *       Forces HTTPS for all future requests. Railway already serves
 *       only over HTTPS so this just locks the browser memory of it.
 *   • Permissions-Policy: deny camera/mic/geo by default for the API
 *       The browser only needs these on the FRONTEND for tongue-photo
 *       capture. The API responses don't, so deny.
 *   • Content-Security-Policy
 *       Strict CSP for the API surface — only same-origin connect, no
 *       script execution, no framing. The API never serves HTML so
 *       this is straightforward.
 *
 * Frontend pages on github.io get their own CSP via meta tags or
 * GitHub's own headers; this middleware deliberately doesn't try to
 * cover those because we don't serve them.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $headers = [
            'X-Content-Type-Options'    => 'nosniff',
            'X-Frame-Options'           => 'DENY',
            'Referrer-Policy'           => 'strict-origin-when-cross-origin',
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains; preload',
            'Permissions-Policy'        => 'camera=(), microphone=(), geolocation=(), payment=()',
            'Content-Security-Policy'   => "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
            // Belt and braces — explicitly disable XSS auditor (Chrome dropped it but
            // some scanners flag missing header). Off is the modern recommendation.
            'X-XSS-Protection'          => '0',
        ];

        foreach ($headers as $name => $value) {
            // Don't clobber a header an upstream layer already set
            if (! $response->headers->has($name)) {
                $response->headers->set($name, $value);
            }
        }

        return $response;
    }
}
