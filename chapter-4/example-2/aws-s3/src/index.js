const express = require('express');
const rangeParser = require('range-parser');
const AWS = require('aws-sdk');
const fs = require('fs');

const app = express();

AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY; 
AWS.config.secretAccessKey = process.env.AWS_SECRET_KEY;
AWS.config.region = "ap-southeast-1";

const bucketName    = 'video-storage-microservice';
const objKey        = 'SampleVideo_1280x720_1mb.mp4';

console.log(`Serving videos from AWS storage account hoaitran.`);
const PORT = process.env.PORT;
//
// Registers a HTTP GET route to retrieve videos from storage.
//
app.get('/video', async (req, res) => {
    const s3 = new AWS.S3();
    const videoSize = (await s3.headObject({ Bucket: bucketName, Key: objKey }).promise()).ContentLength;
    const videoRange = req.headers.range;
  
    if (videoRange) {
      const parts = rangeParser(videoSize, videoRange);
  
      if (parts === -1) {
        res.status(416).send('Requested range not satisfiable\n');
        return;
      }
  
      res.status(206).header({
        'Content-Range': `bytes ${parts[0].start}-${parts[0].end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': parts[0].end - parts[0].start + 1,
        'Content-Type': 'video/mp4',
      });
  
      s3.getObject({
        Bucket: bucketName,
        Key: objKey,
        Range: `bytes=${parts[0].start}-${parts[0].end}`,
      }).createReadStream().pipe(res);
    } else {
      res.status(200).header({
        'Content-Length': videoSize,
        'Content-Type': 'video/mp4',
      });
  
      s3.getObject({
        Bucket: bucketName,
        Key: objKey,
      }).createReadStream().pipe(res);
    }
  });

//
// Starts the HTTP server.
//
app.listen(PORT, () => {
    console.log(`Microservice online`);
});