

# Challenge Backend

This repository contains a small backend service built using Fastify. The goal of the challenge is to improve configuration, performance, and resilience while keeping the mock server untouched. All changes were made only in the service layer.

================================================================================

# Task 1: Configure and Document the Repository

The original project had no configuration file or documentation. I added the following:

### 1.1 config.json

A simple configuration file was added so the service does not rely on hard-coded values. This file is located inside the service folder.

Contents:

```
{
  "PORT": 3000,
  "API_BASE": "http://event.com",
  "FAILURE_WINDOW_MS": 30000,
  "BACKOFF_MS": 5000
}
```

Reason for doing this:

* Keeps the service flexible without using any third-party libraries.
* The challenge instructions allow configuration changes but restrict using specialized libraries.
* Easy to tune timings during debugging.

### 1.2 .gitignore

Updated `.gitignore` to:

* Avoid committing node_modules
* Keep only source code and the diagram also i didnt put config file in git ignore

Example added entries:

```
node_modules/
npm-debug.log
.env
```

### 1.3 Assets Folder

Created `assets/` folder and added:

```
assets/circuit_flow.jpeg
```

This is the circuit breaker diagram. In the README I refer to this file directly.

### 1.4 Logging

Fastify’s built-in logger was already enabled. I removed extra console.log statements after debugging. The service now logs cleanly.

================================================================================

# Task 2: Improve Performance of /getEventsByUserId

Problem:
The original implementation fetched each event one by one using a loop with `await`. Since the mock API adds delay to each event fetch, the endpoint became slower as the number of events grew.

Debugging steps I performed:

* Logged timing for each event fetch
* Observed total time increasing linearly
* Confirmed the delay was happening inside the mock API and cannot be removed

Fix:
Replaced the loop with a parallel approach using `Promise.all`.

Before:

```
for each event:
  wait for response
  then move to next
```

After:

```
trigger all event fetches at the same time
wait for all of them together
```

Why it works:

* Parallel requests remove the repeated delay
* Overall performance improves significantly
* No change to mock API behavior

Result:
The endpoint stays fast even with many events.

================================================================================

# Task 3: Improve Resilience for /addEvent

The `/addEvent` endpoint depends on a mock external service that starts failing after a certain number of requests. My goal was to create a complete circuit breaker without using external libraries.

I debugged the entire flow step by step:

* Logged timestamps of failures
* Verified transitions between states
* Confirmed backoff timing
* Ensured HALF_OPEN only allows one test request
* Ensured CLOSED resets correctly on success

### 3.1 Failure Tracking

The service stores timestamps of failures.
If 3 failures occur within a 30-second window, the breaker switches to OPEN.

### 3.2 OPEN State Backoff

When the circuit is OPEN:

* All requests immediately return 503
* No calls are made to the external service
* The service waits 5 seconds before allowing one test request

### 3.3 HALF_OPEN State

After the backoff period:

* Only one test request is sent
* If it succeeds: switch to CLOSED and reset counters
* If it fails: go back to OPEN and wait again

### 3.4 CLOSED State

Normal operation. All requests go through.

### 3.5 Diagram

The flow diagram is stored inside:

```
assets/circuit_flow.jpeg
```

This image shows:

* CLOSED state receiving normal traffic
* OPEN state blocking requests and waiting
* HALF_OPEN testing the connection once
* The recovery path back to CLOSED

================================================================================

# How the Circuit Breaker Process Works (Plain Explanation)

This is the verbal explanation that matches your diagram:

1. Start in CLOSED state. Requests are allowed.
2. If the external service keeps failing, count each failure.
3. If the service fails 3 times within 30 seconds, move to OPEN state.
4. When OPEN, do not call the external API. Immediately return 503 to clients.
5. Wait for the backoff time (5 seconds).
6. After the wait, move to HALF_OPEN.
7. In HALF_OPEN, allow exactly one request to hit the external service.
8. If that request succeeds, move to CLOSED and clear the failure history.
9. If it fails again, go back to OPEN and repeat the cycle.

================================================================================

# How to Run the Project

Install dependencies:

```
npm install
```

Start the service:

```
npm start
```

The mock server launches automatically.

================================================================================

# Summary

* Added configuration file
* Added .gitignore and assets folder
* Cleaned up logging
* Improved performance using Promise.all
* Implemented a complete circuit breaker from scratch
* Debugged every state transition to match expected behavior
* Documented everything clearly without touching the mock server
