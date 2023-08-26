# Communication between microservices

## New and familiar tools
This chapter introduces the RabbitMQ software for queuing messages. This will help
us decouple our microservices. We’ll use the npm package, amqplib, to connect our
microservices to RabbitMQ so these can send and receive messages.

|Tool|Version|Purpose|
|---|---|---|
|Docker Compose|1.26.2|ker Compose lets you configure, build, run, and manage multiple containers at the same time.|
|HTTP|1.1 | Hypertext Transfer Protocol (HTTP) is used to send direct (or synchronous messages from one microservice to another.|
|RabbitMQ|3.8.5 | RabbitMQ is the message queuing software that we’ll use to send indirect (or asynchronous) messages from one microservice to another.|
|amqplib |0.5.6 |This npm package allows us to configure RabbitMQ and to send and receive  messages from JavaScript.|

## Getting our microservices talking
In this chapter, we add a third microservice to our application: the history microservice. The purpose of adding this new microservice is to demonstrate communication
among microservices. You can see in figure below how the video-streaming microservice
is sending a stream of messages to the history microservice.

![](../imgs/communication-microservice.jpg)

## Introducing the history microservice
We are using the history microservices in this chapter as an example of how microservices can send and receive messages to each other. Actually, this new microservice
really does have a proper place in FlixTube, and as the name suggests, it records our
user’s viewing history.

To keep the examples in this chapter simple, we’ll drop out the video-storage
microservice from the last chapter, which simplifies the video-streaming microservice.
In fact, for our starting point in this chapter, we’ll revert back to an earlier version of
the video-streaming microservice that has the example video baked into its Docker
image.

![](../imgs/view-history.jpg)

The message we’ll transmit between microservices is the viewed message. This is
how the video-streaming microservice informs the history microservice that the user
has watched a video.

## Live reload for fast iterations
In this section, we’ll upgrade our Docker Compose file to support sharing code
between our development workstation and our containers.

![](../imgs/share-src.jpg)

we’ll use nodemon for this, and we’ll use it across the board for all our
microservices. It automatically restarts each microservice when the code changes.

###  Creating a stub for the history microservice
We’ll create the live reload configuration only for the new history microservice, but
after that, we’ll need to apply this same configuration to each and every microservice.

This doesn’t do anything yet. It’s just a stub and is waiting to have features added. Once we have live reload working for this microservice, we’ll be able to boot our application using Docker Compose. Then, we’ll make live
updates and incremental changes to evolve this new microservice without having to
restart the application.

> Listing 5.1 A stub for the history microservice (chapter-5/example-1/history/src/index.js)
```
const express = require("express");
function setupHandlers(app) {   // This is a stub microservice. Later, we’ll add HTTP routes
                                // and message handlers here!
}

...
```

### Augmenting the microservice for live reload
The npm package, nodemon, is what we’ll use to watch our code and to automatically
restart our microservice when the code changes.
```
$ npm install --save-dev nodemon
```
With the start:dev npm script in place, we can run our microservice like this:
```
$ npm run start:dev
// This invokes nodemon for our microservice like this:
$ nodemon --legacy-watch ./src/index.js
```
### Splitting our Dockerfile for development and production
For all microservices, henceforth, we’ll create not just one but two Dockerfiles. We
now need one for development and another for production. We’ll call the development one Dockerfile-dev and the production one Dockerfile-prod.

> Creating the production Dockerfile (chapter-5/example-1/history/Dockerfile-prod)
```
FROM node:12.18.1-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production 
COPY ./src ./src                    // Copies the source code into the image
CMD npm start                       // Starts the microservice in production mode
```

> Creating the dev Dockerfile (chapter-5/example-1/history/Dockerfile-dev)
```
FROM node:12.18.1-alpine
WORKDIR /usr/src/app
COPY package*.json ./                           // Copies the package.json file into the image.
CMD npm config set cache-min 9999999 && \       // Enables caching for npm installs, making subsequent npm installs faster
    npm install && \ 
    npm run start:dev           // Starts the microservice in development mode, using nodemon for live reload
```

### Updating the Docker Compose file for live reload
> Updating the Docker Compose file for live reload (extract from chapter-5/example-1/docker-compose.yaml)
```
version: '3'
services:

  # ... other services defined here ...

  history:
    image: history
    build: 
      context: ./history
      dockerfile: Dockerfile-dev
    container_name: history

    # Defines volumes that are shared between the host operating system and the container
    volumes:
      - /tmp/history/npm-cache:/root/.npm:z     # Shares the npm cache from the host to the container
      - ./history/src:/usr/src/app/src:z        # Shares the source code directly from the host to the container.
    ports:
      - "4001:80"
    environment:
      - PORT=80
      - NODE_ENV=development
    restart: "no"
```

The next thing that is new is the addition of the `volumes` field, where we create
some Docker volumes to connect the filesystem on our development workstation with
the filesystem of the container. This links our source code directly into the container.
It’s the reason why we didn’t bake our code directly into the image.

### Trying out live reload
Then use Docker Compose to start the application:
```
$ docker-compose up --build
...
video-streaming    | Microservice online.
history            | Hello world!
history            | Microservice online.
```

This example contains the simplified video-streaming microservice and the new stub
history microservice. Check the output from Docker Compose. You should see “Hello
world!” printed out by the stub history microservice as it starts up. To test live reload,
we’ll change the message that is printed by the history microservice:
1. Open the example-1 directory in VS Code. 
2. Find and open the index.js file for the history microservice. 
3. Search for the line of code that prints the `Hello world!` message and change this line of code to print `Hello computer!` instead. 
4. Save the index.js file and then switch back to the Docker Compose output.

When you invoke Docker Compose, you can use the `-f` argument to specify the
Docker Compose file. For instance, if you want to run your application in production
mode on your development workstation, you might like to create a separate *production*
version of your Docker Compose file and run it like this:
```
$ docker-compose -f docker-compose-prod.yml up --build
```

##  Methods of communication for microservices
But before we dive into the
technology for communication, we’ll start with a high-level overview of the two styles
of communication used by microservices: direct messaging and indirect messaging,
also commonly known as `synchronous` and `asynchronous` communication.

### Direct messaging
Direct messaging simply means that one microservice directly sends a message to
another microservice and then receives an immediate and direct response. Direct
messaging is used when we’d like one microservice to directly message a particular
microservice and immediately invoke an action or task within it.
![](../imgs/direct-message.jpg)

### Indirect messaging
Indirect messaging introduces an intermediary between the endpoints in the communication process. We add a middleman to sit between our microservices. For that reason,
the two parties of the communication don’t actually have to know about each other.
- *Messages are sent via an intermediary so that both sender and receiver of the messages don’t know which other microservice is involved*. In the case of the sender, it doesn’t
even know if any other microservice will receive the message at all!
- *Because the receiver doesn’t know which microservice has sent the message, it can’t send a direct reply*. This means that this style of communication can’t be applied in situations where a direct response is required for confirming success or failure.

![](../imgs/indirect-message.jpg)

## Direct messaging with HTTP
In the previous chapter, we used HTTP for data retrieval, which retrieved our streaming video from storage. In this chapter, we use HTTP for a different purpose: sending
direct messages from one microservice to another.

### Directly targeting messages at particular microservices
We can send an HTTP POST message to a particular hostname.
A lookup of the DNS is done automatically when sending an HTTP request, and it translates our hostname to the internet protocol (IP) address of the microservice.

![](../imgs/HTTP-request.jpg)

### Sending a message with HTTP POST
There are two sides to the messaging equation: one microservice sends a message and
another receives it. In this section, we examine how to send a message using an HTTP
POST request.

It implements a new function, `sendViewedMessage`, that sends the viewed message to the history
microservice whenever a user starts watching a video.

> Sending a direct message with HTTP POST (extract from chapter-5/example-2/video-streaming/index.js)
```
function sendViewedMessage(videoPath) {
    const postOptions = {     // Options to the HTTP POST request.
        method: "POST",       // Sets the request method as POST.
        headers: {
            "Content-Type": "application/json",   // Sets the content type for the request's body.
        },
    };

    const requestBody = {     // Body of the HTTP POST request.
        videoPath: videoPath 
    };

    const req = http.request( // Send the "viewed" message to the history microservice.
        "http://history/viewed",
        postOptions
    );

    req.on("close", () => {
        console.log("Sent 'viewed' message to history microservice.");
    });

    req.on("error", (err) => {
        console.error("Failed to send 'viewed' message!");
        console.error(err && err.stack || err);
    });

    req.write(JSON.stringify(requestBody));     // Write the body to the request.
    req.end(); // End the request.
}
```
We direct the request to the history microservice using the URL http://history/viewed. This URL
incorporates both the hostname (`history` in this case) and the route (`viewed` in this case).
### Receiving a message with HTTP POST
The updated `setupHandlers` function adds an HTTP POST handler for the `viewed` route to receive incoming messages.
> Receiving a direct message with HTTP POST (extract from chapter-5/example-2/history/index.js)
```
function setupHandlers(app, db) {

    const videosCollection = db.collection("videos");

    app.post("/viewed", (req, res) => {         // Handle the "viewed" message via HTTP POST request.
        const videoPath = req.body.videoPath;   // Read JSON body from HTTP request.
        videosCollection.insertOne({ videoPath: videoPath })  // Record the "view" in the database.
            .then(() => {
                console.log(`Added video ${videoPath} to history.`);
                res.sendStatus(200);
            })
            .catch(err => {
                console.error(`Error adding video ${videoPath} to history.`);
                console.error(err && err.stack || err);
                res.sendStatus(500);
            });
    });
}
```
Did you notice in the HTTP POST handler how we access the body of the request
through `req.body`? We treated the body of the request as the message *payload*. The
body variable was automatically parsed from the JSON format because we used the
body-parser middleware for Express, installed like this:
```
$ npm install --save body-parser
```
### Testing the updated application
Now it’s time to test our latest code and see for yourself how this kind of messaging
operates.
```
$ cd chapter-5/example-2
$ docker-compose up --build
```

### Sequencing direct messages
The reason this type of messaging is called synchronous communication is that we are
able to coordinate messages as shown in figure below. In the figure, Microservice A is
coordinating the activities of the other microservices.

![](../imgs/direct-messaging.jpg)

##  Indirect messaging with RabbitMQ
RabbitMQ allows us to decouple message senders from message receivers. A sender doesn’t know which, if any, other microservices will handle a
message.

The `video-streaming` microservice is no longer directly coupled to the `history`
microservice. Instead, it is publishing its viewed messages to a message queue. The `history` microservice then pulls messages from the queue in its own time.
![](../imgs/rabbitMQ.jpg)

### Why RabbitMQ?
RabbitMQ is stable and mature. It was developed over a decade ago, and among other
protocols, it implements the Advanced Message Queueing Protocol (AMQP), which is
an open standard for message-broker communication.

###  Indirectly targeting messages to microservices
To publish a message to a queue or an exchange, we must first add a RabbitMQ server
to our application. Then we can use the AMQP code library (called amqplib) to send
and receive messages.

![](../imgs/sent-received-rabbitmq.jpg)

### Creating a RabbitMQ server
Docker Compose file that shows adding a RabbitMQ server to our application.
> Adding a RabbitMQ server to the Docker Compose file (extract from chapter-5/example-3/docker-compose.yaml)

```
version: '3'
services:
 # ... other services defined here ...
  rabbit:
    # We use the management version of the RabbitMQ image. This gives us the RabbitMQ dashboard.
    image: rabbitmq:3.8.5-management    
    container_name: rabbit
    ports:
      - "5672:5672"         # Configures port mappings from the host
      - "15672:15672"       # operating system to the container
    # These are the standard RabbitMQ ports for connecting to the server and viewing the dashboard.
    expose:
      - "5672"
      - "15672"
    restart: always
```

###  Investigating the RabbitMQ dashboard
```
$ cd example-3
$ docker-compose up --build
```

You should also see a stream of output from your RabbitMQ server. Give it some time to start and then
point your web browser at http://localhost:15672/. You can login with the default
user name, `guest`, and the default password, `guest`.

![](../imgs/rabbitmq-management.jpg)

The RabbitMQ dashboard is a useful tool for debugging. I believe it’s always better to
be able to visualize what’s happening rather than just assuming we know what’s happening. The dashboard is one of those great visual tools that make it obvious what our
application is actually doing!

### Connecting our microservice to the message queue
You must first install the amqplib npm package into each microservice that needs to connect to RabbitMQ.
```
$ npm install --save amqplib
```

> Connecting to the RabbitMQ server (extract from chapter-5/example-3/history/index.js)
```
const amqp = require("amqplib");

const RABBIT = process.env.RABBIT;

// ... code omitted here ...
function connectRabbit() {

    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);

    return amqp.connect(RABBIT) // Connect to the RabbitMQ server.
        .then(messagingConnection => {
            console.log("Connected to RabbitMQ.");

            return messagingConnection.createChannel(); // Create a RabbitMQ messaging channel.
        });
}

// ... code omitted here ...
function main() {
    console.log("Hello world!");

    return connectDb()                                          // Connect to the database...
        .then(db => {                                           // then...
            return connectRabbit()                              // connect to RabbitMQ...
                .then(messageChannel => {                       // then...
                    return startHttpServer(db, messageChannel); // start the HTTP server.
                });
        });
}
```

> Configuring the history microservice (extract from chapter-5/example-3/docker-compose.yaml)
```
version: '3'
services:
 # ... other services defined here ...
  history:
    image: history
    build: 
      context: ./history
      dockerfile: Dockerfile-dev
    container_name: history
    volumes:
      - /tmp/history/npm-cache:/root/.npm:z
      - ./history/src:/usr/src/app/src:z
    ports:
     - "4002:80"
    environment:
      - PORT=80
      - RABBIT=amqp://guest:guest@rabbit:5672   # Sets the URl for connecting to RabbitMQ
      - DBHOST=mongodb://db:27017
      - DBNAME=history
      - NODE_ENV=development
    depends_on:
      - db
      - rabbit      # The history microservice now depends on the rabbit container
    restart: "no"
```

The RabbitMQ server is fairly heavy-weight, and it takes time to start up and get ready to accept connections. Our tiny
microservices, on the other hand, are lightweight and ready in just moments.

 What happens when our microservice attempts the connection to RabbitMQ and
it’s not ready yet? It will error and abort! What’s the simplest way to solve this problem? We’ll add an extra command to our `Dockerfile` that delays our microservice until the RabbitMQ server is ready. We’ll use
the handy wait-port command installed using npm:
```
$ npm install --save wait-port
```
> Updated Dockerfile for the history microservice, which waits for RabbitMQ(chapter-5/example-3/history/Dockerfile-dev)
```
FROM node:12.18.1-alpine

WORKDIR /usr/src/app
COPY package*.json ./

CMD npm config set cache-min 9999999 && \
    npm install && \
    npx wait-port rabbit:5672 && \      # Uses npx to invoke the locally installed wait-port command to wait until the 
                                        # server at hostname rabbit is accepting connections on port 5672
    npm run start:dev
```

### Single-recipient indirect messaging
Single-recipient messages are *one-to-one*: a message is sent from one
microservice and received by only a single other. This is a great way of making
sure that a particular job is done only once within your application.

- RECEIVING SINGLE-RECIPIENT MESSAGES
    
    >  Consuming viewed messages from a RabbitMQ queue (extract from chapter-5/example-3/history/index.js)

    ```
    function setupHandlers(app, db, messageChannel) {

    const videosCollection = db.collection("videos");

    // ... YOU CAN PUT HTTP ROUTES AND OTHER MESSAGE HANDLERS HERE ...

    function consumeViewedMessage(msg) { // Handler for coming messages.
        console.log("Received a 'viewed' message");

        const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message.
        
        return videosCollection.insertOne({ videoPath: parsedMsg.videoPath }) // Record the "view" in the database.
            .then(() => {
                console.log("Acknowledging message was handled.");
                
                messageChannel.ack(msg); // If there is no error, acknowledge the message.
            });
    };

    return messageChannel.assertQueue("viewed", {}) // Assert that we have a "viewed" queue.
        .then(() => {
            console.log("Asserted that the 'viewed' queue exists.");

            return messageChannel.consume("viewed", consumeViewedMessage); // Start receiving messages from the "viewed" queue.
        });
    }
    ```

- SENDING SINGLE-RECIPIENT MESSAGES

    >  Publishing viewed messages to a RabbitMQ queue (extract from chapter-5/example-3/video-streaming/index.js)
    ```
    function sendViewedMessage(messageChannel, videoPath) {
    console.log(`Publishing message on "viewed" queue.`);

    const msg = { videoPath: videoPath };
    const jsonMsg = JSON.stringify(msg);    // Converts the message to the JSON format
    messageChannel.publish("", "viewed", Buffer.from(jsonMsg)); // Publish message to the "viewed" queue.
    }
    ```

- TESTING SINGLE-RECIPIENT MESSAGES
    ```
    $ docker-compose up --build
    ```

Wait for the database and RabbitMQ to start and the microservices to establish their
connections. Now point your web browser at http://localhost:4001/video. Check the
output to see that the message has been sent and received. You can use Studio 3T to check that the history microservice has created a new record for the view in its
database.

### Multiple-recipient messages
Multiple-recipient messages are *one-to-many*: a message is sent from
only a single microservice but potentially received by many others. This is a
great way of publishing notifications within your application.

![](../imgs/multiple-recipients.jpg)

- RECEIVING MULTIPLE-RECIPIENT MESSAGES

    >  Consuming viewed messages from a RabbitMQ exchange (extract from chapter-5/example-4/history/index.js)
    ```
    function setupHandlers(app, db, messageChannel) {

    const videosCollection = db.collection("videos");

    // ... YOU CAN PUT HTTP ROUTES AND OTHER MESSAGE HANDLERS HERE ...

    function consumeViewedMessage(msg) { // Handler for coming messages.
        console.log("Received a 'viewed' message");

        const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message.
        
        return videosCollection.insertOne({ videoPath: parsedMsg.videoPath }) // Record the "view" in the database.
            .then(() => {
                console.log("Acknowledging message was handled.");
                
                messageChannel.ack(msg); // If there is no error, acknowledge the message.
            });
    };

    return messageChannel.assertExchange("viewed", "fanout") // Assert that we have a "viewed" exchange.
        .then(() => {
            return messageChannel.assertQueue("", { exclusive: true }); // Create an anonyous queue.
        })
        .then(response => {
            const queueName = response.queue;
            console.log(`Created queue ${queueName}, binding it to "viewed" exchange.`);
            return messageChannel.bindQueue(queueName, "viewed", "") // Bind the queue to the exchange.
                .then(() => {
                    return messageChannel.consume(queueName, consumeViewedMessage); // Start receiving messages from the anonymous queue.
                });
        });
    }
    ```

- SENDING MULTIPLE-RECIPIENT MESSAGES
    >  Publishing viewed messages to a RabbitMQ exchange (extract from chapter-4/example-3/video-streaming/index.js)
    ```
    function connectRabbit() {

    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);

    return amqp.connect(RABBIT) // Connect to the RabbitMQ server.
        .then(connection => {
            console.log("Connected to RabbitMQ.");

            return connection.createChannel() // Create a RabbitMQ messaging channel.
                .then(messageChannel => {
                    return messageChannel.assertExchange("viewed", "fanout") // Assert that we have a "viewed" exchange.
                        .then(() => {
                            return messageChannel;
                        });
                });
        });
    }

    function sendViewedMessage(messageChannel, videoPath) {
    console.log(`Publishing message on "viewed" exchange.`);
        
    const msg = { videoPath: videoPath };
    const jsonMsg = JSON.stringify(msg);
    messageChannel.publish("viewed", "", Buffer.from(jsonMsg)); // Publish message to the "viewed" exchange.
    }
    ```