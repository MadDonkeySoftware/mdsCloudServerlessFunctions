const express = require('express');

const router = express.Router();

const sampleHandler = (request, response) => {
  const { params, body } = request;
  const { param1 } = params;

  const msg = {
    ts: new Date().toISOString(),
    topic: param1,
    message: body,
  };

  response.write(JSON.stringify(msg));

  response.status(200);
  response.send();
};

router.get('/sample/:param1', sampleHandler);

module.exports = router;
