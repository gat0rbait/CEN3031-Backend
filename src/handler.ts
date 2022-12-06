"use strict";

import * as AWS from "aws-sdk";
import Joi from "joi";
const tasksTableName = process.env.AWS_TASKSTABLEID;

interface task {
  id: string,
  created_at: number,
  type: string,
  name: string,
  body: string,
  reporter: string,
  status: string,
  priority: string
}

interface user {
  isAdmin: boolean,
    userData: {
      businessName: string,
      email: string,
      name: string,
      picture: string,
      phone_number: string
  },
    userGroups: string[],
    username: string
}

interface reference {
  id: string,
  created_at: number,
  type: string
}


const userSchema = Joi.object({
  isAdmin: Joi.boolean(),
  verified: Joi.string(),
    userData: {
      businessName: Joi.string().required(),
      email: Joi.string().email().required(),
      name: Joi.string().required(),
      picture: Joi.string().required(),
      phone_number: Joi.string().required(),
  },
    userGroups: Joi.array(),
    username: Joi.string().required(),
    forcePasswordReset: Joi.string()
})

const taskSchema = Joi.object({
  name: Joi.string().required(),
  body: Joi.string().required(),
  reporter: Joi.string(),
  status: Joi.string().valid("OPEN", "IN_PROGRESS", "CLOSED").required(),
  priority: Joi.string().valid("LOW", "HIGH").required()
});

const updateTaskSchema = Joi.object({
  id: Joi.string().required(),
  status: Joi.string().valid("OPEN", "IN_PROGRESS", "CLOSED").required()
});

const referenceSchema = Joi.object({
  id: Joi.string().required(),
  created_at: Joi.date().timestamp().raw().required(),
});

const createTask = async (event: any) => {
  let data: task = JSON.parse(event.body);
  console.log(data);

  let validatedData = taskSchema.validate(data);
  if (validatedData.error) {
    return {
      statusCode: 400,
      body: JSON.stringify(validatedData.error.details),
    };
  }

  let { name, body, reporter, priority, status } = validatedData.value;
  let currentIndex = await getIndex()
  let nextIndex = currentIndex + 1
  let id = nextIndex

  let prefix = "KANDU-"
  id = id.toString();
  while (id.length < 4) id = "0" + id;
  id = prefix + id
  
  let created_at = Date.now()
  let taskData: task = {
    type: "task",
    id,
    created_at,
    name,
    body,
    reporter,
    status,
    priority
  };

  let username = "testUser";

  let referenceData: reference = {
    type: "reference",
    id: `${username}#${id}`,
    created_at,
  };

  let docClient = new AWS.DynamoDB.DocumentClient();
  let taskParams = {
    TableName: tasksTableName,
    ConditionExpression:
      "attribute_not_exists(#t) AND attribute_not_exists(#i)",
    ExpressionAttributeNames: {
      "#t": "type",
      "#i": "id",
    },
    Item: taskData,
  };

  let taskResult: any;
  taskResult = await new Promise(function (resolve, reject) {
    docClient.put(taskParams, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  }).catch((err) => {
    console.log({ err });
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    };
  });

  console.log(taskResult);

  if (taskResult.statusCode && taskResult.statusCode != 200) {
    console.log({ taskResult });
    return {
      statusCode: 400,
      body: "The specified work order already exists.",
    };
  }

  await updateTableIndex(nextIndex)


  let referenceParams = {
    TableName: tasksTableName,
    Item: referenceData,
  };

  let referenceResult: any;
  referenceResult = await new Promise(function (resolve, reject) {
    docClient.put(referenceParams, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  }).catch((err) => {
    console.log({ err });
  });
  

  return {
    statusCode: 200,
    body: JSON.stringify(taskData),
  };
};

const getTasks = async (event: any, context: any) => {

  let params = {
    TableName: tasksTableName,
    KeyConditionExpression: "#t = :t",
    ExpressionAttributeNames: {
      "#t": "type",
    },
    ExpressionAttributeValues: {
      ":t": "task",
    },
  };

  let docClient = new AWS.DynamoDB.DocumentClient();
  let tasksResult: any;
  tasksResult = await new Promise(function (resolve, reject) {
    docClient.query(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  console.log(tasksResult);

  if (tasksResult.Count == 0) {
    return {
      statusCode: 404,
      body: "Not Found",
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(tasksResult),
  };
};

const getTask = async (event: any) => {
  if (!event.pathParameters.id || event.pathParameters.id == "") {
    return {
      statusCode: 400,
      body: "No id provided.",
    };
  }

  console.log(event)

  let id = event.pathParameters.id;

  let result: any = await getTaskData(id)

  console.log(result)
  if (!result) {
    return {
      statusCode: 404,
      body: "Not Found",
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};

const updateTask  = async (event: any) => {
  let data = JSON.parse(event.body);
  console.log({data});

  let validatedData = updateTaskSchema.validate(data);
  if (validatedData.error) {
    return {
      statusCode: 400,
      body: JSON.stringify(validatedData.error.details),
    };
  }

  let { id, status } = validatedData.value;
  let type = "task";

  let docClient = new AWS.DynamoDB.DocumentClient();

  let params = {
    TableName: tasksTableName,
    Key: {
      type,
      id
    },
    UpdateExpression: "set #st = :st",
    ExpressionAttributeNames: {
      "#st": "status"
    },
    ExpressionAttributeValues: {
      ":st": status
    },
    ReturnValues: "ALL_NEW",
  };

  let result: any;
  result = await new Promise(function (resolve, reject) {
    docClient.update(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      result,
    }),
  };
}

const deleteTask = async (event:any) => {
  if (!event.pathParameters.id || event.pathParameters.id == "") {
    return {
      statusCode: 400,
      body: "No id provided.",
    };
  }

  console.log(event)
  let id = event.pathParameters.id;
  let type = "task";

  let docClient = new AWS.DynamoDB.DocumentClient();
  let params = {
    ReturnValues: "ALL_OLD",
    TableName: tasksTableName,
    Key: {
      type,
      id
    },
  };

  let result: any;
  result = await new Promise(function (resolve, reject) {
    docClient.delete(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  }).catch((err) => {
    console.log({ err });
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    };
  });

  console.log({result});

  if (Object.keys(result).length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Not Found",
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      result,
    }),
  };
}

const getTaskData = async (id: string) => {
  let docClient = new AWS.DynamoDB.DocumentClient();
  let params = {
    TableName: tasksTableName,
    KeyConditionExpression: "id = :id AND #t = :t",
    ExpressionAttributeNames: {
      "#t": "type",
    },
    ExpressionAttributeValues: {
      ":id": id,
      ":t": "task"
    },
  };

  let result: any;
  result = await new Promise(function (resolve, reject) {
    docClient.query(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  if (result.Count == 0) {
    return false
  }

  let task = result.Items[0];
  console.log(task)

  return task
}

const getIndex = async () => {
  let docClient = new AWS.DynamoDB.DocumentClient();
  let params = {
        TableName: tasksTableName,
        Key: {
          "id": "index",
          "type": "index"
        }
    };

  let result: any;
  result = await new Promise(function (resolve, reject) {
    docClient.get(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  console.log(result)

  let index;
  if (Object.keys(result).length == 0) {
    index = await createIndexTable()
  } else {
    index = result.Item.value
  }

  return index
}

const updateTableIndex = async (newIndex: number) => {
  let docClient = new AWS.DynamoDB.DocumentClient();

  let params = {
    TableName: tasksTableName,
    Key: {
      type: "index",
      id: "index"
    },
    UpdateExpression: "set #v = :v",
    ExpressionAttributeNames: {
      "#v": "value",
    },
    ExpressionAttributeValues: {
      ":v": newIndex
    },
    ReturnValues: "UPDATED_NEW",
  };

  let result: any;
  result = await new Promise(function (resolve, reject) {
    docClient.update(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  return result;
}

const createIndexTable = async () => { 
  let docClient = new AWS.DynamoDB.DocumentClient();
  let params = {
    TableName: tasksTableName,
    ConditionExpression:
      "attribute_not_exists(#t) AND attribute_not_exists(#i)", //check this
    ExpressionAttributeNames: {
      "#t": "type",
      "#i": "id",
    },
    Item: {
      id: "index",
      type: "index",
      value: 0
    },
  };

  let indexResult = await new Promise(function (resolve, reject) {
    docClient.put(params, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  }).catch((err) => {
    console.log({ err });
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    };
  });

  return 0
}

module.exports = {
  createTask, 
  getTask, 
  getTasks, 
  updateTask,
  deleteTask,
  getIndex, 
  createIndexTable, 
  updateTableIndex 
};


