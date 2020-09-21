// updated Node.JS script for reading from Azure IoT Hub and sending to Log Analytics
// add     "axios": "0.19.0"    to the dependency section of package.json
// Author: Kevin Saye, reference: https://github.com/veyalla/iotedge-labs/tree/05104d80c962cdf3fbca5e53d31989533425c7e9/codelabs/src/monitor-iotedge/routeViaIoTHub

module.exports = async function(context, IoTHubMessages) {
    const crypto = require('crypto'); 
    const axios = require('axios');
    const process = require('process');    

    const wId = process.env['wid'];     // get these from an application setting on the Azure Function
    const wKey = process.env['wKey'];   // get these from an application setting on the Azure Function
    const apiVersion = '2016-04-01';

    context.log(`JavaScript eventhub trigger function called for message`);

    // in case there are multiple messages or a batch of messages
    IoTHubMessages.forEach(messageArray => {
        messageArray.forEach(async message => {
            /*  each message looks something like:
                {
                    "MetricKey": {                          // not really sure what to do with this
                        "IsValueCreated": false,
                        "Value": -1901736074
                    },
                    "TimeGeneratedUtc": "2020-09-18T19:08:29.9109662Z",
                    "Name": "edgehub_queue_length",
                    "Value": 0,
                    "Tags": {
                        "iothub": "voiddetection.azure-devices.net",
                        "edge_device": "testkey",
                        "instance_number": "5594486c-430d-4756-9442-d335da36f4f2",
                        "endpoint": "iothub",
                        "priority": "2000000000"
                    }
                }
            */
    
            //context.log(`inner message is is ${JSON.stringify(message)}`);

            // converting the IoT Hub format to match what the module sends
            var modifiedMessage = {
                "Computer": message.Tags.edge_device,   // normally null, could be message.Tags.edge_device
                "RawData": "",                          // normally null
                "Tags_s": JSON.stringify(message.Tags),
                "TimeGenerated": message.TimeGeneratedUtc,
                "TimeGeneratedUtc_t": message.TimeGeneratedUtc,
                "Name_s": message.Name,
                "Value_d": message.Value,
                "Type": "promMetrics_CL"
            };

            const body = JSON.stringify(modifiedMessage);
            let processingDate = new Date().toUTCString();
            let contentLength = Buffer.byteLength(body, 'utf8');
            let stringToSign = 'POST\n' + contentLength + '\napplication/json\nx-ms-date:' + processingDate + '\n/api/logs';
            let signature = crypto.createHmac('sha256', new Buffer.from(String(wKey), 'base64')).update(stringToSign, 'utf8').digest('base64');
            let authorization = 'SharedKey ' + wId + ':' + signature;

            var headers = {
                "content-type": "application/json",
                "Authorization": authorization,
                "Log-Type": "promMetrics",
                "x-ms-date": processingDate
            };

            const args = {
                headers: headers,
                body: body
            };

            const url = 'https://' + wId + '.ods.opinsights.azure.com/api/logs?api-version=' + apiVersion;
            try {
                const response = await axios.post(url, body, { headers: headers });
                //context.log(`statusCode: ${response.status}`);
            } catch (error) {
                // If the promise rejects, an error will be thrown and caught here
                context.log(error);
            }
        });
    });
};