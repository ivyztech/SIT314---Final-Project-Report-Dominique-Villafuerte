const AWS = require('aws-sdk');
const { unmarshall } = AWS.DynamoDB.Converter;


exports.handler = async (event) => {
const records = event.Records || [];
for (const r of records) {
if (r.eventName !== 'INSERT') continue;
const img = r.dynamodb && r.dynamodb.NewImage ? unmarshall(r.dynamodb.NewImage) : null;
if (!img) continue;


// Filter already handled by event source, but keep a guard
if (img.status === 'FAKE' || img.status === 'USED') {
console.log(JSON.stringify({
alert: 'TICKET_FLAGGED',
ticketId: img.pk.replace('TICKET#',''),
status: img.status,
riskScore: img.riskScore || null,
traceId: img.traceId || null
}));
}
}
return { ok: true };
};