/**
 * Webhook that sends a Slack message.
 */

const https = require('https');
const slackWebhookPath = process.env.SLACK_WEBHOOK_PATH;

/**
 * Posts a given message to a Slack webhook
 *
 * @method sendMsg
 * @param {String} msg
 * @return {Promise} A promise that returns the response from Slack if resolved
 * and an error if rejected.
 */
const sendMsg = msg => {
  return new Promise((resolve, reject) => {
    let data = JSON.stringify({
      text: msg
    });
        
    let options = {
      hostname: 'hooks.slack.com',
      port: 443,
      path: slackWebhookPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    let req = https.request(options, (res) => {
      console.log(`statusCode: ${res.statusCode}`);
      res.on('data', (d) => {
        process.stdout.write(d);
      });
    });
    
    req.on('error', (error) => {
      console.error(error);
      reject(error);
    });
    
    req.write(data);
    req.end();
    
    resolve();
  });
};

exports.handler = async (event, context, callback) => {
  console.log(JSON.stringify(event, null, 2));

  let body = JSON.parse(event.body);
  let response = {
    context: body.context || {}
  };

  if (!body.state) {
    return errorResponse({
      message: 'bad request',
      responseCode: 400,
      callback: callback
    });
  }

  // get all the values from the Action payload
  let cloudWatchUrl = body.payload['cloudWatchUrl'];
  let logGroupName = body.payload['logGroupName'];
  let time = body.payload['time'];
  
  // construct the message
  let msg = `Here is your filtered log group <${cloudWatchUrl}|${logGroupName}> for the past *${time}*`;
  
  // send the message
  await sendMsg(msg);
  
  return successResponse({
    body: response,
    callback: callback
  });
};
/**
 * NO NEED TO TOUCH ANYTHING BELOW
 */

const successResponse = ({
  body,
  callback
}) => {
  callback(null, {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
};
const errorResponse = ({
  message,
  responseCode,
  callback
}) => {
  callback(null, {
    statusCode: responseCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      errorMessage: message,
      responseCode: responseCode
    })
  });
};
