import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ConnectionTableName = process.env.CONNECTION_TABLE_NAME!;

export const handler: APIGatewayProxyHandler = async (event, _context) => {
  console.log(event);
  const routeKey = event.requestContext.routeKey!;
  const connectionId = event.requestContext.connectionId!;

  if (routeKey == "$connect") {
    return { statusCode: 200, body: "Connected." };
  }
  if (routeKey == "$disconnect") {
    try {
      await removeConnectionId(connectionId);
      return { statusCode: 200, body: "Disconnected." };
    } catch (err) {
      console.error(err);
      return { statusCode: 500, body: "Disconnection failed." };
    }
    // Default route
  } else {
    // Just echo back messages in other route than connect, disconnect (for testing purpose)
    const domainName = event.requestContext.domainName!;
    // When we use a custom domain, we don't need to append a stage name
    const endpoint = domainName.endsWith("amazonaws.com")
      ? `https://${event.requestContext.domainName}/${event.requestContext.stage}`
      : `https://${event.requestContext.domainName}`;

    const managementApi = new ApiGatewayManagementApiClient({
      endpoint,
    });

    try {
      // This is where the message gets sent back to client.
      await managementApi.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(
            JSON.stringify({
              message: event.body,
            }),
            "utf-8",
          ),
        }),
      );
    } catch (e: any) {
      if (e.statusCode == 410) {
        await removeConnectionId(connectionId);
      } else {
        console.log(e);
        throw e;
      }
    }

    return { statusCode: 200, body: "Received." };
  }
};

async function removeConnectionId(connectionId: string) {
  return await client.send(
    new DeleteCommand({
      TableName: ConnectionTableName,
      Key: {
        connectionId,
      },
    }),
  );
}
