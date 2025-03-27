const ivm = require("isolated-vm");
const { whitelistModules } = require("./config");

const accessKeyId = "***";
const secretAccessKey = "***";

// load all the modules
async function loadModules() {
  const modules = {};
  for (const module of whitelistModules) {
    try {
      modules;
      modules[module] = require(module);
    } catch (error) {
      console.error(`Error loading module ${module}:`, error);
    }
  }

  const flatModules = Object.entries(modules).reduce(
    (acc, [key, value]) => ({ ...acc, ...value }),
    {}
  );
  return flatModules;
}

// =================== Done loading modules ===================

// Create SageMaker Client
const createSageMakerClient = (
  SageMakerRuntimeClient,
  InvokeEndpointCommand
) => {
  const sagemakerCredentials = {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  };

  let client;
  if (
    !sagemakerCredentials.accessKeyId ||
    !sagemakerCredentials.secretAccessKey
  ) {
    console.log("Initializing SageMaker client without credentials");

    client = new SageMakerRuntimeClient({
      endpoint: "https://runtime.sagemaker.us-east-1.amazonaws.com",
      region: "us-east-1",
    });
  } else {
    client = new SageMakerRuntimeClient({
      endpoint: "https://runtime.sagemaker.us-east-1.amazonaws.com",
      region: "us-east-1",
      credentials: sagemakerCredentials,
    });
  }

  return {
    send: async (commandParams) => {
      try {
        if (typeof commandParams.Body === "string") {
          commandParams.Body = Buffer.from(commandParams.Body, "base64");
        }

        const command = new InvokeEndpointCommand(commandParams);

        const response = await client.send(command);

        return response.Body.toString("utf-8");
      } catch (error) {
        console.error("SageMaker invocation error:", error);
        return `Error: ${error.message}`;
      }
    },
  };
};

const exposeSagMakerSDK = async (context, modules) => {
  const { SageMakerRuntimeClient, InvokeEndpointCommand, ...rest } = modules;
  const clientProxy = createSageMakerClient(
    SageMakerRuntimeClient,
    InvokeEndpointCommand
  );

  // Expose the SageMaker client inside the isolate
  await context.evalClosure(
    `global.client = {
      send: async (commandParams) => {
        return $0.applySync(undefined, [commandParams], { arguments: { copy: true }, result: { promise: true, copy: true } });
      }
    }`,
    [clientProxy.send],
    { arguments: { reference: true } }
  );

  for (const [key, value] of Object.entries({
    InvokeEndpointCommand,
    ...rest,
  })) {
    if (typeof value !== "function") return;

    if (key.search("Command") !== -1) {
      await context.evalClosure(
        `global.${key} = function(params) {
            return params;
          }`
      );
    } else {
      await context.evalClosure(
        `global.${key} = function(params) {
            return $0.applySync(undefined, [params], { arguments: { copy: true }, result: { copy: true } });
       }`,
        [(params) => value(params)],
        { arguments: { reference: true } }
      );
    }
  }
};

const exposeBuffer = async (context) => {
  await context.evalClosure(
    `global.Buffer = {
      from: function(data) {
        return $0.applySync(undefined, [data], { arguments: { copy: true }, result: { copy: true } });
      }
    }`,
    [(data) => Buffer.from(data).toString("base64")],
    { arguments: { reference: true } }
  );
};

const exposeConsoleLog = async (context, global) => {
  const consoleMethods = ["log", "info", "warn", "error"];
  const consoleName = (method) => `console__${method}`;

  for (const method of consoleMethods) {
    global.setSync(consoleName(method), function (...args) {
      console[method](...args);
    });
  }

  context.evalSync(
    `console = {${consoleMethods
      .map((m) => `${m}: ${consoleName(m)}`)
      .join(", ")}};`
  );
};

(async () => {
  const isolate = new ivm.Isolate({ memoryLimit: 2048 });
  const context = await isolate.createContext();
  const jail = context.global;
  jail.setSync("global", jail.derefInto());

  const modules = await loadModules();
  await exposeConsoleLog(context, jail);
  await exposeBuffer(context);
  await exposeSagMakerSDK(context, modules);

  const givenPayload = {
    password: "***",
  };

  const playLoad = {
    inputs: JSON.stringify(givenPayload),
  };

  await context.eval(`const LLM_USER_Payload = ${JSON.stringify(playLoad)}`);

  const script = `
      (async function() {
        const endpointName = "endpoint-name";
        const payload = LLM_USER_Payload;
        // this is optional if you want to use the default credentials
        const sageMakerAccessKeyId = "test";
        // this is optional if you want to use the default credentials
        const sageMakerSecretAccessKey = "test";
        const region = "us-east-1";

        console.log("Payload: ", payload);
        try {
            const command = new InvokeEndpointCommand({
                EndpointName: endpointName,
                Body: Buffer.from(JSON.stringify(payload)),
                ContentType: "application/json"
            });

            const response = await client.send(command);
            console.log("response: ", response);

            return response;  // Return result to main process
        } catch (error) {
            return "Error invoking SageMaker: " + error.message;
        }
      })()
  `;

  try {
    const result = await context.eval(script, { promise: true });
    const byteArray = result.split(",").map(Number);
    const uint8Array = new Uint8Array(byteArray);
    const decodedString = new TextDecoder().decode(uint8Array);
    console.log("SageMaker Response in Main Process:", decodedString);
    return decodedString;
  } catch (err) {
    console.log("JS execution error:", err);
  } finally {
    context.release();
  }
})();
