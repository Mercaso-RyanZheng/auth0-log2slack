const axios = require('axios');

module.exports = function (context, callback) {
    const slackWebhookUrl = context.webtask.secrets.SLACK_WEBHOOK_URL;

    const auth0 = context.auth0;
    const lastRun = context.storage.get('lastRun', (err, data) => {
        if (err) return callback(err);
        const lastRun = data || new Date(0).toISOString();
        const now = new Date().toISOString();

        // 添加过滤条件，查询所有失败事件
        auth0.logs.getAll({
            q: `date:[${lastRun} TO ${now}] AND type:(fp fn fsa fcp fs)`,
            per_page: 100,
            sort: 'date:1',
            fields: 'date,type,description,connection,client_name',
            include_fields: true
        })
            .then(logs => {
                if (logs.length === 0) {
                    return callback(null, 'No new failure logs');
                }

                // 格式化日志消息
                const messages = logs.map(log => {
                    return `• *${log.type}*: ${log.description || ''} (${log.date})`;
                }).join('\n');

                // 发送到 Slack
                return axios.post(slackWebhookUrl, {
                    text: `Failure events detected:\n${messages}`
                })
                    .then(() => {
                        // 保存本次运行时间
                        context.storage.set('lastRun', now, err => {
                            if (err) return callback(err);
                            return callback(null, 'Failure logs sent to Slack');
                        });
                    });
            })
            .catch(err => {
                console.error('Error sending logs to Slack:', err);
                return callback(err);
            });
    });
};