// Vercel Serverless Function
// এই ফাইলটি যখন কেউ /api?num=xxx হিট করবে তখন চলবে

module.exports = async (req, res) => {
    // ১. URL থেকে নাম্বার নিন
    const phone = req.query.num || req.query.phone;

    // ২. নাম্বার না দিলে বা ভুল হলে এরর দেখান
    if (!phone) {
        return res.status(400).json({ error: 'num parameter missing. Example: /api?num=01712345678' });
    }

    // ৩. নাম্বারটি সঠিক ফরম্যাটে আছে কিনা চেক করুন (০১ দিয়ে শুরু, ১১ ডিজিট)
    if (!/^01[3-9]\d{8}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid Bangladesh number. Use 01XXXXXXXXX format.' });
    }

    try {
        // ৪. apis.json ফাইলটি লোড করুন
        // Vercel-এ ফাইল লোড করার জন্য require ব্যবহার করা হয়
        const apis = require('./apis.json').apis;

        const results = [];
        let successCount = 0;

        // ৫. প্রতিটি API-তে রিকোয়েস্ট পাঠান
        // মোবাইলে চালানোর জন্য, আমরা একটার পর একটা (serial) পাঠাবো যেন টাইমআউট না হয়
        for (const api of apis) {
            // নাম্বার সঠিকভাবে ফরম্যাট করুন
            const p10 = phone.substring(1); // 1712345678
            const p13 = '88' + phone;       // 8801712345678

            // URL এবং Body-তে ***** কে নাম্বার দিয়ে রিপ্লেস করুন
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

            // Fetch API দিয়ে রিকোয়েস্ট পাঠান
            const fetchOptions = {
                method: api.method.toUpperCase(),
                headers: api.headers || {}
            };

            // POST হলে body যুক্ত করুন
            if (api.method.toLowerCase() === 'post' && body) {
                fetchOptions.body = body;
            }

            try {
                // ৫ সেকেন্ড টাইমআউট
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                fetchOptions.signal = controller.signal;

                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                const ok = response.status >= 200 && response.status < 300;
                if (ok) successCount++;

                results.push({
                    id: api.id,
                    name: api.name,
                    status: response.status,
                    ok: ok
                });
            } catch (err) {
                // যেকোনো এরর হলে সেটাও রেকর্ড করুন
                results.push({
                    id: api.id,
                    name: api.name,
                    status: 'ERROR',
                    ok: false,
                    error: err.message.substring(0, 50) // এরর মেসেজ ছোট করে দেখান
                });
            }

            // পরের রিকোয়েস্টের আগে একটু বিরতি দিন (অপশনাল)
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // ৬. ফলাফল পাঠিয়ে দিন
        res.status(200).json({
            phone: phone,
            total: apis.length,
            success: successCount,
            failed: apis.length - successCount,
            details: results
        });

    } catch (error) {
        // সার্ভারে কোনো বড় এরর হলে
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};
