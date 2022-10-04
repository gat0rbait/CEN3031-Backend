"use strict";

import * as AWS from "aws-sdk";
// const tableName = process.env.AWS_BUSINESSTABLEID;

const getRequest = async (event: any, context: any) => {
  // let data = JSON.parse(event.body)
  // console.log(data)

  if (!event.pathParameters.name || event.pathParameters.name == "") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No value provided." }),
    };
  }

  let name = event.pathParameters.name;

  // let docClient = new AWS.DynamoDB.DocumentClient();
  // let params = {
  //   TableName: tableName,
  //   Key: {
  //     name: name,
  //   },
  // };

  // let result: any;
  // result = await new Promise(function (resolve, reject) {
  //   docClient.get(params, (err: any, data: any) => {
  //     if (err) reject(err);
  //     else resolve(data);
  //   });
  // });

  // console.log(result);

  // if (Object.keys(result).length === 0) {
  //   return {
  //     statusCode: 404,
  //     body: JSON.stringify({
  //       message: "Not Found",
  //     }),
  //   };
  // }

  return {
    statusCode: 200,
    body: JSON.stringify({
      name,
      event,
    }),
  };
};

const hello = async (event: any, context: any) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v2.0! Your function executed successfully! Test update for CI/CD!',
        input: event,
      },
      null,
      2
    ),
  };
};

module.exports = {
  hello,
  getRequest
};
