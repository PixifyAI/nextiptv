// app/api/iptv-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[Proxy] Received POST request');
  try {
    const body = await request.json();
    console.log('[Proxy] Request Body:', { action: body.action, server: body.serverUrl ? '***' : 'MISSING', user: body.username ? '***' : 'MISSING', pass: body.password ? '***' : 'MISSING', params: body.params });

    const { serverUrl, username, password, action, params } = body;

    // Validation
    if (!serverUrl || !username || !password || !action) {
      console.error('[Proxy] Error: Missing required parameters in request body.');
      return NextResponse.json({ error: 'Proxy Error: Missing required parameters (serverUrl, username, password, action)' }, { status: 400 });
    }
    if (!serverUrl.startsWith('http://')) {
        // Enforce http based on user requirement, could also allow https if needed later
        console.warn(`[Proxy] Warning: Server URL "${serverUrl}" did not start with http://. Ensure this is intended.`);
        // Potentially return error if only http is allowed:
        // return NextResponse.json({ error: 'Proxy Error: Server URL must start with http://' }, { status: 400 });
    }

    // Construct target URL
    let targetUrl = `${serverUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${encodeURIComponent(action)}`;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) { // Ensure value exists
           targetUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
        }
      });
    }
    console.log(`[Proxy] Fetching target URL: ${targetUrl.replace(password, '***')}`); // Log target without password

    // Make the request from Next.js server to Xtreme Codes server
    const apiResponse = await fetch(targetUrl, {
      method: 'GET', // Xtreme Codes usually uses GET
      headers: { 'User-Agent': 'NextJS IPTV Proxy/1.0' },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log(`[Proxy] Xtreme API response status: ${apiResponse.status}`);
    const responseBodyText = await apiResponse.text(); // Read body as text first

    // Log part of the response for debugging, be careful with sensitive data
    console.log(`[Proxy] Xtreme API response body (first 500 chars): ${responseBodyText.substring(0, 500)}${responseBodyText.length > 500 ? '...' : ''}`);

    // Prepare response headers (specifically for JSON)
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json');

    // Handle non-OK responses from Xtreme API
    if (!apiResponse.ok) {
      console.error(`[Proxy] Xtreme API Error (${apiResponse.status}): ${responseBodyText}`);
      // Try to parse error as JSON, otherwise return text
      let errorDetails: any = { message: `Upstream API Error: ${apiResponse.statusText}`, raw: responseBodyText };
      try {
          const parsedError = JSON.parse(responseBodyText);
          // If it's an object, merge it, otherwise keep the raw text
          if (typeof parsedError === 'object' && parsedError !== null) {
            errorDetails = { ...errorDetails, ...parsedError };
          }
      } catch (e) { /* Keep original errorDetails */ }

      // Return error response to the client
      return NextResponse.json({ error: errorDetails.message || 'API request failed', details: errorDetails }, { status: apiResponse.status >= 500 ? 502 : apiResponse.status, headers: responseHeaders }); // Use 502 for upstream server errors
    }

    // Attempt to parse successful response as JSON
    try {
      const data = JSON.parse(responseBodyText);
      console.log('[Proxy] Parsed Xtreme API JSON response successfully.');
      // Send successful data back to the client
      return NextResponse.json(data, { status: 200, headers: responseHeaders });
    } catch (e) {
      console.error('[Proxy] Error parsing successful Xtreme API response as JSON:', e);
      // Return an error if JSON parsing failed even on a 200 OK response
      return NextResponse.json({ error: 'Proxy Error: Failed to parse upstream API response as JSON.', details: responseBodyText }, { status: 502, headers: responseHeaders }); // 502 Bad Gateway might be appropriate
    }

  } catch (error: any) {
    console.error('[Proxy] CATCH Block Error:', error);
    let errorMessage = 'Proxy Internal Server Error';
    let status = 500;
     if (error.name === 'AbortError') {
         errorMessage = 'Proxy Error: Request to upstream API timed out.';
         status = 504; // Gateway Timeout
     } else if (error.message) {
         errorMessage = error.message;
     }
    return NextResponse.json({ error: 'Proxy request failed', details: errorMessage }, { status: status });
  }
}

// Optional: Add a GET handler if needed for testing/simple cases,
// but POST is better for sending credentials.
// export async function GET(request: NextRequest) {
//   console.log('[Proxy] Received GET request');
//   return NextResponse.json({ message: 'Proxy operational. Use POST for API calls.' });
// }