import { CfnOutput } from "aws-cdk-lib";
import {
  aws_cognito as cognito,
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_authorizers as apigatewayv2_auth,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class API extends Construct {
  public readonly websocket: apigatewayv2.WebSocketApi;
  constructor(
    scope: Construct,
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ) {
    super(scope, id);
    this.websocket = this._webSocket(userPool, userPoolClient);

    new CfnOutput(this, "WebsocketHost", {
      value: this.websocket.apiEndpoint!,
    });
  }

  _webSocket(
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ): apigatewayv2.WebSocketApi {
    const connectionIdTable = new dynamo.Table(this, "ConnectionIdTable", {
      partitionKey: { name: "connectionId", type: dynamo.AttributeType.STRING },
      timeToLiveAttribute: "removedAt",
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    connectionIdTable.addGlobalSecondaryIndex({
      partitionKey: { name: "userId", type: dynamo.AttributeType.STRING },
      indexName: "userIdIndex",
    });

    const authHandler = new lambdaNode.NodejsFunction(this, "AuthHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../Lambdas/websocket/authorizer/index.ts"),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        APP_CLIENT_ID: userPoolClient.userPoolClientId,
        CONNECTION_TABLE_NAME: connectionIdTable.tableName,
      },
    });

    const websocketHandler = new lambdaNode.NodejsFunction(
      this,
      "WebSocketHandler",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, "../Lambdas/websocket/handler/index.ts"),
        environment: {
          CONNECTION_TABLE_NAME: connectionIdTable.tableName,
        },
      },
    );
    connectionIdTable.grantReadWriteData(websocketHandler);
    connectionIdTable.grantReadWriteData(authHandler);

    const authorizer = new apigatewayv2_auth.WebSocketLambdaAuthorizer(
      "Authorizer",
      authHandler,
      {
        identitySource: ["route.request.querystring.idToken"],
      },
    );

    let apiv2Websocket = new apigatewayv2.WebSocketApi(
      this,
      "knowledgeBaseWebSocket",
      {
        description:
          "Used by the rice cooker data dashboard to integrate services",
        connectRouteOptions: {
          authorizer,
          integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
            "ConnectIntegration",
            websocketHandler,
          ),
        },
        disconnectRouteOptions: {
          integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
            "DisconnectIntegration",
            websocketHandler,
          ),
        },
        defaultRouteOptions: {
          integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
            "DefaultIntegration",
            websocketHandler,
          ),
        },
      },
    );

    new apigatewayv2.WebSocketStage(this, "dev", {
      webSocketApi: apiv2Websocket,
      stageName: "dev",
      autoDeploy: true,
    });

    apiv2Websocket.grantManageConnections(websocketHandler);

    return apiv2Websocket;
  }
}
