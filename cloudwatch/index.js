/**
 * Webhook that resolves a log group alias to
 * a CloudWatch URL
 */

const moment = require('moment');
const AWS = require('aws-sdk');
const cloudwatchlogs = new AWS.CloudWatchLogs();

// Map for resolving the log group name
const logGroups = {
  "alias 1": "<log-group-name-1>",
  "alias 2": "<log-group-name-2>",
  "alies 3": "<log-group-name-3>"
};

// New Console URL
const rootLogUri = "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group";

/**
 * Converts miliseconds into a human readable string.
 *
 * @method convertMstoStr
 * @param {Number} milliseconds
 * @return {String} An object containing the number of days, 
 * hours, minutes and seconds.
 */
const convertMstoStr = (milliseconds) => {
  var day, hour, minute, second;
  second = Math.floor(milliseconds / 1000);
  minute = Math.floor(second / 60);
  second = second % 60;
  hour = Math.floor(minute / 60);
  minute = minute % 60;
  day = Math.floor(hour / 24);
  hour = hour % 24;

  let timeStr = "";
  if (day) timeStr += day === 1 ? '24 hours ' : `${day} days `;
  if (hour) timeStr += hour === 1 ? '1 hour ' : `${hour} hours `;
  if (minute) timeStr += minute === 1 ? '1 minute ' : `${minute} minutes `;
  if (second) timeStr += second === 1 ? '1 second ' : `${second} seconds `;

  return timeStr;
};

/**
 * Search a CloudWatch log group for a given timeframe.
 * Checks to see if there is data in that timeframe by
 * returning only 1 event.
 *
 * @method searchLogs
 * @param {String} logGroupName - the name of the CloudWatch log group
 * @param {Number} timeframe - the number of milliseconds
 * @returns {Promise} A promise that returns the response from CloudWatch if resolved
 * and an error if rejected.
 */
const searchLogs = (logGroupName, timeframe) => {
  return new Promise((resolve, reject) => {
    let params = {
      logGroupName: logGroupName,
      startTime: new Date().getTime() - timeframe,
      endTime: new Date().getTime(),
      limit: 1
    };
    cloudwatchlogs.filterLogEvents(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

/**
 * Generate the CloudWatch URI from the given conversation state.
 *
 * @method getLogs
 * @param {Object} state - the conversation state
 * @param {Object} context - the conversation context
 * @returns {Object} A resolved value or an error.
 */
const getLogs = async (state, context) => {
  let response = {
    value: null,
    failureReason: null
  };

  try {
    // get the Slot values from the conversation state
    let logGroupAlias = state['LogGroupAlias'] ? state['LogGroupAlias'].value : null;
    let timeframe = state['Timeframe'] ? state['Timeframe'].value : null;

    let logGroupName = logGroups[logGroupAlias];
    let millisec = Number(moment.duration(timeframe));

    if (!logGroupName) {
      throw new Error('could not find log group');
    }
    
    let logPath = `/${encodeURIComponent(logGroupName)}`;
    logPath += `/log-events?start=-${encodeURIComponent(millisec)}`;
    
    let logs = await searchLogs(logGroupName, millisec);
  
    let isEmpty = 'true';
    if (logs && logs.events && logs.events.length > 0) isEmpty = 'false';

    response.value = {
      cloudWatchUrl: rootLogUri + logPath,
      logGroupName: logGroupName,
      time: convertMstoStr(millisec),
      isEmpty: isEmpty
    };

  } catch (e) {
    console.log(e);
    response.failureReason = e.errorMessage;
  }

  return response;
};

exports.handler = async (event, context, callback) => {
  console.log(JSON.stringify(event, null, 2));

  let body = JSON.parse(event.body);
  let response = {
    resolvedVariables: [],
    unresolvedVariables: [],
    context: body.context || {}
  };

  if (!body.variables) {
    return errorResponse({
      message: 'bad request',
      responseCode: 400,
      callback: callback
    });
  }

  if (!body.state) {
    return errorResponse({
      message: 'bad request',
      responseCode: 400,
      callback: callback
    });
  }

  for (const variable of body.variables) {
    let resolutionResponse = null;

    /**
     * Iterate over the input variables and try to resolve each of them.
     *
     * Note: This is the only other section that you'd need to update.
     */

    switch (variable.variableId) {
      case 'AWSLogGroups':
        resolutionResponse = await getLogs(body.state, response.context);
        break;
      default:
        break;
    }

    // Variables can have single and multi value responses

    if (resolutionResponse && resolutionResponse.value) {
      // Single value variable response

      response.resolvedVariables.push({
        variableId: variable.variableId,
        value: resolutionResponse.value
      });
    }
    else if (resolutionResponse && resolutionResponse.values) {
      // Multi value variable response (typically used for answer choices)

      response.resolvedVariables.push({
        variableId: variable.variableId,
        values: resolutionResponse.values
      });
    }
    else {
      // If anything goes wrong, append the variableId to the
      // unresolvedVariables array and attach an optional failure reason

      response.unresolvedVariables.push({
        variableId: variable.variableId,
        reason: resolutionResponse ? resolutionResponse.failureReason : 'unhandled failure'
      });
    }
  }

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
