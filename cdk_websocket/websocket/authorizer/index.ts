import { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdTokenPayload } from "aws-jwt-verify/jwt-model";

const UserPoolId = process.env.USER_POOL_ID!;
const AppClientId = process.env.APP_CLIENT_ID!;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ConnectionTableName = process.env.CONNECTION_TABLE_NAME!;

export const handler: APIGatewayRequestAuthorizerHandler = async (
  event,
  _context,
) => {
  try {
    const verifier = CognitoJwtVerifier.create({
      userPoolId: UserPoolId,
      tokenUse: "id",
      clientId: AppClientId,
    });

    const connectionId = event.requestContext.connectionId!;
    const encodedToken = event.queryStringParameters!.idToken!;
    const payload = await verifier.verify(encodedToken);

    console.log("Token is valid. Payload:", payload);
    await saveSession(payload, connectionId);
    console.log("User information saved to database!");
    return allowPolicy(event.methodArn, payload);
  } catch (error: any) {
    console.log(error.message);
    return denyAllPolicy();
  }
};

async function saveSession(
  payload: CognitoIdTokenPayload,
  connectionId: string,
) {
  try {
    await client.send(
      new PutCommand({
        TableName: ConnectionTableName,
        Item: {
          userName: payload["cognito:username"] ?? "",
          userGroups: payload["cognito:groups"] ?? "",
          userEmail: payload["email"] ?? "",
          userId: payload.sub,
          connectionId: connectionId,
          removedAt: Math.ceil(Date.now() / 1000) + 3600 * 3,
        },
      }),
    );
  } catch (err) {
    console.error(err);
  }
}

function allowPolicy(methodArn: string, idToken: any) {
  return {
    principalId: idToken.sub,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Allow",
          Resource: methodArn,
        },
      ],
    },
    context: {
      // set userId in the context
      userId: idToken.sub,
    },
  };
}

function denyAllPolicy() {
  return {
    principalId: "*",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "*",
          Effect: "Deny",
          Resource: "*",
        },
      ],
    },
  };
}
