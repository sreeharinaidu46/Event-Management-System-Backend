
const fastify = require("fastify")({ logger: true });
const listenMock = require("../mock-server");

const config = require("../config.json");

const PORT = config.PORT || 3000;
const API_BASE = config.API_BASE || "http://event.com";         
const FAILURE_WINDOW_MS = config.FAILURE_WINDOW_MS || 30000;
const BACKOFF_MS = config.BACKOFF_MS || 5000;


let failureTimestamps = []; // Iam Storing failure timestamps
let circuitState = "CLOSED"; // Other Possible states are: "OPEN", "HALF_OPEN"
let nextAttemptTime = 0; // When OPEN Ends


fastify.get("/getUsers", async (request, reply) => {
  const resp = await fetch(`${API_BASE}/getUsers`);
  const data = await resp.json();
  reply.send(data);
});

//i added circuit breaker logic here
fastify.post("/addEvent", async (request, reply) => {
  const currentTimeStamp = Date.now();


  // Circuit Breaker Logic
  if (circuitState === "OPEN") {
 
  if (currentTimeStamp >= nextAttemptTime) {

    circuitState = "HALF_OPEN";
  } else {
    return reply.status(503).send({
      message: "Service Unavailable --- Please Try Again Later"
    });
  }
}

  try {
    const resp = await fetch(`${API_BASE}/addEvent`, {
      method: "POST",
      body: JSON.stringify({
        id: new Date().getTime(),
        ...request.body,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) {
      throw new Error(data.message || "External Service Failure");
    }
    // Resrtting Circuit on Success
    if (circuitState === "HALF_OPEN") {
      circuitState = "CLOSED";
      failureTimestamps = [];
    }
    return reply.send(data);
  } catch(err) {

  // Only count failures when CLOSED or HALF_OPEN
  if (circuitState !== "OPEN") {
    failureTimestamps.push(currentTimeStamp);

    failureTimestamps = failureTimestamps.filter(ts => 
      currentTimeStamp - ts < FAILURE_WINDOW_MS
    );
  }

  if (circuitState === "HALF_OPEN") {
    circuitState = "OPEN";
    nextAttemptTime = currentTimeStamp + BACKOFF_MS;
    return reply.status(503).send({ message: "Service Unavailable --- Please Try Again Later" });
  }

  if (failureTimestamps.length >= 3) {
    circuitState = "OPEN";
    nextAttemptTime = currentTimeStamp + BACKOFF_MS;
    return reply.status(503).send({ message: "Service Unavailable --- Please Try Again Later" });
  }

  return reply.status(503).send(err.message);
}

});

fastify.get("/getEvents", async (request, reply) => {
  const resp = await fetch(`${API_BASE}/getEvents`);
  const data = await resp.json();
  reply.send(data);
});

fastify.get("/getEventsByUserId/:id", async (request, reply) => {
  const { id } = request.params;
  const user = await fetch(`${API_BASE}/getUserById/` + id);
  const userData = await user.json();
  const userEvents = userData.events;

  const eventPromises = userEvents.map((userEventId) =>
    fetch(`${API_BASE}/getEventById/` + userEventId).then((res) =>
      res.json()
    )
  );
  const eventArray = await Promise.all(eventPromises);
  // for(let i = 0; i < userEvents.length; i++) {
  //     const event = await fetch('http://event.com/getEventById/' + userEvents[i]);
  //     const eventData = await event.json();
  //     eventArray.push(eventData);
  // }
  reply.send(eventArray);
});

fastify.listen({ port: PORT }, (err) => {
  listenMock();
  if (err) {
    fastify.log.error(err);
    process.exit();
  }
});
