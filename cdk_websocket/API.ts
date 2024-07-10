import { Tags, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import {
  aws_cognito as cognito,
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_apigatewayv2_authorizers as apigatewayv2_auth,
  aws_lambda_nodejs as lambdaNode,
  aws_lambda as lambda,
  aws_dynamodb as dynamo,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { APIPaths } from "../../types";
import * as path from "path";

export class API extends Construct {
  /// OKAY!
  public readonly api: apigatewayv2.HttpApi;
  public readonly apiAuthv2: apigatewayv2_auth.HttpUserPoolAuthorizer;
  public readonly apiPaths: APIPaths;

  public readonly websocket: apigatewayv2.WebSocketApi;
  constructor(
    scope: Construct,
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ) {
    super(scope, id);
    Tags.of(this).add("SubConstruct", "API");
    this.api = this._apiGateway(userPool, userPoolClient);

    // NOt using the websocket..
    // this.websocket = this._webSocket(userPool, userPoolClient);
    //
    // new CfnOutput(this, "WebsocketHost", {
    //   value: this.websocket.apiEndpoint!,
    // });

    new CfnOutput(this, "APIHost", { value: this.api.url! });
  }

  _apiGateway(
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ): apigatewayv2.HttpApi {
    let apiAuthv2 = new apigatewayv2_auth.HttpUserPoolAuthorizer(
      "cognitoAuthV2",
      userPool,
      { userPoolClients: [userPoolClient] },
    );

    let api = new apigatewayv2.HttpApi(this, "riceCookerDataAPI", {
      description: "Used by the rice cooker data system to integrate services",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
      },
      defaultAuthorizer: apiAuthv2,
    });

    return api;
  }

  // _webSocket(
  //   userPool: cognito.UserPool,
  //   userPoolClient: cognito.UserPoolClient,
  // ): apigatewayv2.WebSocketApi {
  //   const connectionIdTable = new dynamo.Table(this, "ConnectionIdTable", {
  //     partitionKey: { name: "connectionId", type: dynamo.AttributeType.STRING },
  //     timeToLiveAttribute: "removedAt",
  //     billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  //     removalPolicy: RemovalPolicy.DESTROY,
  //   });
  //
  //   connectionIdTable.addGlobalSecondaryIndex({
  //     partitionKey: { name: "userId", type: dynamo.AttributeType.STRING },
  //     indexName: "userIdIndex",
  //   });
  //
  //   const authHandler = new lambdaNode.NodejsFunction(this, "AuthHandler", {
  //     runtime: lambda.Runtime.NODEJS_18_X,
  //     entry: path.join(__dirname, "../Lambdas/websocket/authorizer/index.ts"),
  //     environment: {
  //       USER_POOL_ID: userPool.userPoolId,
  //       APP_CLIENT_ID: userPoolClient.userPoolClientId,
  //       CONNECTION_TABLE_NAME: connectionIdTable.tableName,
  //     },
  //   });
  //
  //   const websocketHandler = new lambdaNode.NodejsFunction(
  //     this,
  //     "WebSocketHandler",
  //     {
  //       runtime: lambda.Runtime.NODEJS_18_X,
  //       entry: path.join(__dirname, "../Lambdas/websocket/handler/index.ts"),
  //       environment: {
  //         CONNECTION_TABLE_NAME: connectionIdTable.tableName,
  //       },
  //     },
  //   );
  //   connectionIdTable.grantReadWriteData(websocketHandler);
  //   connectionIdTable.grantReadWriteData(authHandler);
  //
  //   const authorizer = new apigatewayv2_auth.WebSocketLambdaAuthorizer(
  //     "Authorizer",
  //     authHandler,
  //     {
  //       identitySource: ["route.request.querystring.idToken"],
  //     },
  //   );
  //
  //   let apiv2Websocket = new apigatewayv2.WebSocketApi(
  //     this,
  //     "knowledgeBaseWebSocket",
  //     {
  //       description:
  //         "Used by the rice cooker data dashboard to integrate services",
  //       connectRouteOptions: {
  //         authorizer,
  //         integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
  //           "ConnectIntegration",
  //           websocketHandler,
  //         ),
  //       },
  //       disconnectRouteOptions: {
  //         integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
  //           "DisconnectIntegration",
  //           websocketHandler,
  //         ),
  //       },
  //       defaultRouteOptions: {
  //         integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
  //           "DefaultIntegration",
  //           websocketHandler,
  //         ),
  //       },
  //     },
  //   );
  //
  //   new apigatewayv2.WebSocketStage(this, "dev", {
  //     webSocketApi: apiv2Websocket,
  //     stageName: "dev",
  //     autoDeploy: true,
  //   });
  //
  //   apiv2Websocket.grantManageConnections(websocketHandler);
  //
  //   return apiv2Websocket;
  // }
}
