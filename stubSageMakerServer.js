const express = require("express");
const bodyParser = require("body-parser");
const { Readable } = require("stream");

const app = express();
const port = 4567;

app.use(bodyParser.json());

// ping endpoint
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Handle synchronous inference (InvokeEndpointCommand)
app.post("/endpoints/:endpointName/invocations", (req, res) => {
  console.log("Received sync inference request:", req.body);

  res.json({
    prediction: `Processed input: ${JSON.stringify(req.body)}`,
  });
});

// Handle asynchronous inference (InvokeEndpointAsyncCommand)
app.post("/endpoints/:endpointName/async-invocations", (req, res) => {
  console.log("Received async inference request:", req.body);

  // Simulate returning an S3 URL for results
  res.json({
    InferenceId: "test-inference-id",
    OutputLocation: "s3://mock-bucket/output/test-inference-id.json",
  });
});

// Handle streaming inference (InvokeEndpointWithResponseStreamCommand)
app.post("/endpoints/:endpointName/stream-invocations", (req, res) => {
  console.log("Received streaming request:", req.body);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  const stream = new Readable({
    read() {},
  });

  // Simulate streaming response chunks
  const responses = [
    { output: "Processing..." },
    { output: "Almost done..." },
    { output: "Final result!" },
  ];

  let index = 0;

  const interval = setInterval(() => {
    if (index < responses.length) {
      stream.push(JSON.stringify(responses[index]) + "\n");
      index++;
    } else {
      stream.push(null); // End stream
      clearInterval(interval);
    }
  }, 1000);

  stream.pipe(res);
});

// Start the server
app.listen(port, () => {
  console.log(`Mock SageMaker server running at http://localhost:${port}`);
});
