import * as dotenv from 'dotenv';
import * as schedule from 'node-schedule';
import { RABBITMQ_QUEUES } from '../data/constants';
import { mergeServiceMonsterCustomers } from '../data/modules/serviceMonster/getServiceMonsterCustomers';
import { getConfig, sendRequest } from '../data/utils';

import { connect } from '../db/connection';
import { Customers } from '../db/models';
import { debugCrons } from '../debuggers';
import messageBroker from '../messageBroker';

/**
 * Send conversation messages to customer
 */
dotenv.config();

export const createCustomersFromServiceMonster = async () => {
  await connect();
  const customers = await Customers.find();
  const sortedList = customers.sort((a, b) => (a.modifiedAt.getSeconds as any) - (b.modifiedAt.getSeconds as any));
  const last = sortedList[sortedList.length - 1];
  debugger;
  console.log(last.modifiedAt.toISOString());
  var timeStampString = last.modifiedAt.toISOString();
  const url = `https://api.servicemonster.net/v1/accounts?wField=timeStamp&wValue=${timeStampString}&wOperator=gt`;
  console.log(url);
  // debugger;
  const rawSMData = await sendRequest({
    url,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic a0drYU9XeEQ6VkF0emhNVG91ZW1VbDN3',
    },
    method: 'GET',
  });
  console.log(rawSMData);
  let data;
  let error;

  if (typeof rawSMData === 'string') {
    data = JSON.parse(rawSMData).items;
    error = JSON.parse(rawSMData).error;
    if (data.length < 1) {
      return 'no new customers';
    }
  } else {
    data = rawSMData.items;
    if (data.length < 1) {
      return 'no new customers';
    }
    error = rawSMData.error;
  }
  let fileType = 'raw';
  let fileName = null;
  const UPLOAD_SERVICE_TYPE = await getConfig('UPLOAD_SERVICE_TYPE', 'AWS');

  try {
    const result = await messageBroker().sendRPCMessage(RABBITMQ_QUEUES.RPC_API_TO_WORKERS, {
      action: 'createImport',
      type: 'customer',
      fileType,
      fileName,
      uploadType: UPLOAD_SERVICE_TYPE,
      data: data,
      // scopeBrandIds,
      // user: req.user,
    });
    console.log(result);
  } catch (e) {
    return console.log(`Integration not found: ${e}`);
  }
  // const result =
  // await  mergeServiceMonsterCustomers(last.modifiedAt);

  // console.log(result);
  // for (const customer of customers) {
  //   const ids = await fetchBySegments(segment);

  //   const customers = await Customers.find({ smId: { $in: ids } }, { smId: 1 });
  //   const customerIds = customers.map(c => c._id);

  //   await ActivityLogs.createSegmentLog(segment, customerIds, 'customer');

  // }
};

/**
 * *    *    *    *    *    *
 * ┬    ┬    ┬    ┬    ┬    ┬
 * │    │    │    │    │    |
 * │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
 * │    │    │    │    └───── month (1 - 12)
 * │    │    │    └────────── day of month (1 - 31)
 * │    │    └─────────────── hour (0 - 23)
 * │    └──────────────────── minute (0 - 59)
 * └───────────────────────── second (0 - 59, OPTIONAL)
 */
schedule.scheduleJob('1 * * * * *', async () => {
  debugCrons('Checked createCustomersFromServiceMonster');
  createCustomersFromServiceMonster();
});
