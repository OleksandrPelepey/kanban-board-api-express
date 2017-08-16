var express = require('express');
var capitalize = require('capitalize');
var passport = require('passport');
var conditional = require('express-conditional-middleware');
var fileExists = require('file-exists');
var path = require('path');

var router = express.Router();

router.route('/:modelName/(:docId/)?')
  .all( 
    conditional(
      function(req, res) {
        return !(req.path == '/user/' && req.method == 'POST');
      }, 
      passport.authenticate('jwt', { session: false } )
    ),
    function(req, res, next) {
      req.query = {};
      next();
    },
    findModel
  )
  .get(checkIdParam, findDoc, checkDocPerm)
  .post(checkStaticPerm, createDoc, sendDoc)
  .put(checkIdParam, findDoc, checkDocPerm, updateDoc, sendDoc)
  .delete(checkIdParam, findDoc, checkDocPerm, deleteDoc, sendDoc);

router.get('/card/(:docId/)?', populateCard);

router.route('/:modelName/(:docId/)?')
  .get(sendDoc);
  // .post(checkStaticPerm, createDoc, sendDoc)
  // .put(checkIdParam, findDoc, checkDocPerm, updateDoc, sendDoc)
  // .delete(checkIdParam, findDoc, checkDocPerm, deleteDoc, sendDoc);

function findModel(req, res, next) {
  var modelName = capitalize.words(req.params.modelName);
  var modelPath = path.dirname( path.dirname(__filename) ) + '\\/models\\/' + modelName;

  if ( !fileExists.sync(modelPath + '.js') ) {
    return res.status(400).json({
      error: {
        message: 'Such model doesn\'t exist'
      }
    });
  }

  var Model = require(modelPath);
  req.query.Model = Model;

  next();
}

function checkIdParam(req, res, next) {
  if (!req.params.docId) {
    return res.status(400).json({
      error: req.method + ' method require id paramether.'
    });
  }
  next();
}

function checkStaticPerm(req, res, next) {
  var permissionName = 'canUser' + capitalize.words(req.method.toLowerCase());

  if (req.query.Model[permissionName]) {
    req.query.Model[permissionName](req.user, req.body).then(function(access) {
      if (!access) {
        return res.status(403).json({
          error: {
            message: 'You have not permissions to do it.'
          }
        });
      }

      next();
    });
  } else {
    next();
  }
}

function checkDocPerm(req, res, next) {
  var permissionName = 'canUser' + capitalize.words(req.method.toLowerCase());

  if (req.query.doc[permissionName]) {
    req.query.doc[permissionName](req.user).then(function(access) {
      if (!access) {
        return res.status(403).json({
          error: {
            message: 'You have not permissions to do it.'
          }
        });
      }
      
      next();
    });
  } else {
    next();
  }
}

function createDoc(req, res, next) {
  if (!!req.query.Model.schema.paths.author && !req.body.author) {
    req.body.author = req.user._id;
  }

  req.query.Model.create(req.body, function(err, doc) {
    if (err) {
      return res.json({
        error: {
          message: err.message
        }
      });
    }

    req.query.doc = doc;
    next();
  });
}

function updateDoc(req, res, next) {
  var doc = req.query.doc;

  for (var prop in req.body) {
    doc[prop] = req.body[prop];
  }

  doc.save(function(err, doc) {
    if (err) {
      return res.json({
        error: {
          message: err.message
        }
      });
    }

    req.query.doc = doc;
    next();
  });
}

function findDoc(req, res, next) {
  req.query.Model.findById(req.params.docId, function(err, doc) {
    if (err) {
      return res.json({
        error: err.message
      });
    }

    if (!doc) {
      return res.status(404).json({
        error: {
          message: "Such document was not found."
        }
      });
    }

    req.query.doc = doc;
    next();
  });
}

function deleteDoc(req, res, next) {
  req.query.Model.deleteOne({_id: req.params.docId}, function(err, operationRes) {
    if (err) {
      return res.json({
        error: {
          message: err.message
        }
      })
    }

    req.query.doc = {};
    next();
  });
}

function sendDoc(req, res) {
  res.json(req.query.doc);
}

// Cards
function populateCard(req, res, next) {
  req.query.doc.populate('attachments', function(err, doc) {
    if (err) {
      res.json({
        error: {
          message: err.message
        }
      });
    }
    req.query.doc = doc;
    next();
  });
}


module.exports = router;