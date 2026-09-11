// Vercel Serverless Function
module.exports = async (req, res) => {
    const phone = req.query.num || req.query.phone;

    if (!phone) {
        return res.status(400).json({ error: 'num parameter missing. Example: /api?num=01712345678' });
    }

    if (!/^01[3-9]\d{8}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid Bangladesh number. Use 01XXXXXXXXX format.' });
    }

    try {
        const allApis = require('./apis.json').apis;

        // ⏱️ শুধু প্রথম ৫০টি API চালান (৬০ সেকেন্ড টাইমআউট এড়াতে)
        const apis = allApis.slice(0, 50);

        const p10 = phone.substring(1);
        const p13 = '88' + phone;

        // 🚀 প্রতিটি API কে একটি async function বানান
        const tasks = apis.map(async (api) => {
            let url = api.url;
            url = url.replace('+88*****', '+' + p13);
            url = url.replace('88*****', p13);
            url = url.replace('0*****', '0' + p10);
            url = url.replace('*****', phone);

            let body = api.body || '';
            body = body.replace('+88*****', '+' + p13);
            body = body.replace('88*****', p13);
            body = body.replace('0*****', '0' + p10);
            body = body.replace('*****', phone);

            const fetchOptions = {
                method: api.method.toUpperCase(),
                headers: api.headers || {}
            };

            if (api.method.toLowerCase() === 'post' && body) {
                fetchOptions.body = body;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                fetchOptions.signal = controller.signal;

                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                const ok = response.status >= 200 && response.status < 300;
                return {
                    id: api.id,
                    name: api.name,
                    status: response.status,
                    ok: ok
                };
            } catch (err) {
                return {
                    id: api.id,
                    name: api.name,
                    status: 'ERROR',
                    ok: false,
                    error: err.message.substring(0, 40)
                };
            }
        });

        // 🔥 সব API একসাথে প্যারালালি চালান
        const results = await Promise.all(tasks);

        const successCount = results.filter(r => r.ok).length;

        res.status(200).json({
            phone: phone,
            total: results.length,
            success: successCount,
            failed: results.length - successCount,
            details: results
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};
