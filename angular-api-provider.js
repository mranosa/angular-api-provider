/**
 * Example of using an angular provider to build an api service.
 * @author Jeremy Elbourn (@jelbourn)
 *
 * https://gist.github.com/jelbourn/8015527
 */

/** Namespace for the application. */
var app = {};

/******************************************************************************/

/**
 * Interface for a model objects used with the api service.
 * @interface
 */
app.ApiModel = function() {};

/**
 * Data transformation done after fetching data from the server.
 * @type {Function}
 */
app.ApiModel.prototype.afterLoad;

/**
 * Data transformation done before posting / putting data to the server.
 * @type {Function}
 */
app.ApiModel.prototype.beforeSave;

/******************************************************************************/

/**
 * Configuration object for an api endpoint.
 * @constructor
 */
app.ApiEndpointConfig = function() {
  /**
   * Map of actions for the endpoint, keyed by action name. An action has a HTTP
   * method (GET, POST, etc.) as well as an optional set of default parameters.
   * @type {Object.<string, {method: string, params: Object}>}
   */
  this.actions = {};

  /** The default actions defined for every endpoint. */
  var defaultActions = {
    'GET': 'get',
    'PUT': 'update',
    'POST': 'save',
    'PATCH': 'patch',
    'DELETE': 'remove'
  };

  // Add the default actions to this endpoint.
  var self = this;
  angular.forEach(defaultActions, function(alias, method) {
    self.addHttpAction(method, alias);
  });
};


/**
 * Set the route for this endpoint. This is relative to the server's base route.
 * @param {string} route
 * @return {app.ApiEndpointConfig}
 */
app.ApiEndpointConfig.prototype.route = function(route) {
  this.route = route;
  return this;
};


/**
 * Set the route for this endpoint. This is relative to the server's base route.
 * @param {function(): app.ApiModel} model
 * @return {app.ApiEndpointConfig}
 */
app.ApiEndpointConfig.prototype.model = function(model) {
  this.model = model;
  return this;
};

/**
 * Adds an action to the endpoint.
 * @param {string} method The HTTP method for the action.
 * @param {string} name The name of the action.
 * @param {Object=} params The default parameters for the action.
 * @param {Object=} options Additional `actions` to add to the `$resource`.
 */
app.ApiEndpointConfig.prototype.addHttpAction = function(method, name, params, options) {
  this.actions[name] = angular.extend({
    method: method.toUpperCase(),
    params: params
  }, options);
  return this;
};

/**
 * Adds an action to 'query' or accept an array of results to the endpoint.
 * @param {string=} name The name of the action to accept an array.
 */
app.ApiEndpointConfig.prototype.enableQuery = function(name) {
  name = name || 'query';
  this.actions[name] = this.actions[name] || {};
  this.actions[name].isArray = true;
  return this;
};

/******************************************************************************/

/**
 * An api endpoint.
 *
 * @constructor
 * @param {string} baseRoute The server api's base route.
 * @param {app.ApiEndpointConfig} endpointConfig Configuration object for the
 *     endpoint.
 * @param {!Object} $injector The angular $injector service.
 * @param {!Function} $resource The angular $resource service.
 */
app.ApiEndpoint = function(baseRoute, endpointConfig, $injector, $resource) {
  this.config = endpointConfig;
  this.$injector = $injector;
  this.resource = $resource(baseRoute + endpointConfig.route, {},
    endpointConfig.actions);

  // Extend this endpoint objects with methods for all of the actions defined
  // in the configuration object. The action performed depends on whether or
  // not there is a model defined in the configuration; when there is a model
  // defined, certain request types must be wrapped in order to apply the
  // pre/post request transformations defined by the model.
  var self = this;
  angular.forEach(endpointConfig.actions, function(action, actionName) {
    var actionMethod = self.request;

    if (action.model) {
      if (action.method === 'GET') {
        actionMethod = self.getRequestWithModel;
      } else if (action.method === 'PUT' || action.method === 'POST') {
        actionMethod = self.saveRequestWithModel;
      }
    }

    self[actionName] = angular.bind(self, actionMethod, actionName);
  });
};


/**
 * Instantiates a model object from the raw server response data.
 * @param {Object} data The raw server response data.
 * @return {app.ApiModel} The server response data wrapped in a model object.
 */
app.ApiEndpoint.prototype.instantiateModel = function(data) {
  var model = this.$injector.instantiate(this.config.model);
  angular.extend(model, data);
  model.afterLoad();

  return model;
};

/**
 * Perform a standard http request.
 *
 * @param {string} action The name of the action.
 * @param {Object=} params The parameters for the request.
 * @param {Object=} data The request data (for PUT / POST requests).
 * @return {angular.$q.Promise} A promise resolved when the http request has
 *     a response.
 */
app.ApiEndpoint.prototype.request = function(action, params, data) {
  return this.resource[action](params, data).$promise;
};

/**
 * Perform an HTTP GET request and performs a post-response transformation
 * on the data as defined in the model object.
 *
 * @param {string} action The name of the action.
 * @param {Object=} params The parameters for the request.
 * @return {angular.$q.Promise} A promise resolved when the http request has
 *     a response.
 */
app.ApiEndpoint.prototype.getRequestWithModel = function(action, params) {
  var promise = this.request(action, params);
  var instantiateModel = this.instantiateModel.bind(this);

  // Wrap the raw server response data in an instantiated model object
  // (or multiple, if response data is an array).
  return promise.then(function(response) {
    var data = response.data;
    response.data = angular.isArray(data) ?
      data.map(instantiateModel) : instantiateModel(data);
  });
};

/**
 * Performs an HTTP PUT or POST after performing a pre-request transformation
 * on the data as defined in the model object.
 *
 * @param {string} action The name of the action.
 * @param {Object=} params The parameters for the request.
 * @param {Object=} data The request data (for PUT / POST requests).
 * @return {angular.$q.Promise} A promise resolved when the http request has
 *     a response.
 */
app.ApiEndpoint.prototype.saveRequestWithModel = function(action, params, data) {
  // Copy the given data so that the beforeSave operation doesn't alter the
  // object state from wherever the request was triggered.
  var model = angular.copy(data);

  if (model && model.beforeSave) {
    model.beforeSave();
  }

  return this.request(action, params, model);
};

/******************************************************************************/

/**
 * Angular provider for configuring and instantiating as api service.
 *
 * @constructor
 */
app.ApiProvider = function() {
  this.baseRoute = '';
  this.endpoints = {};
};

/**
 * Sets the base server api route.
 * @param {string} route The base server route.
 */
app.ApiProvider.prototype.setBaseRoute = function(route) {
  this.baseRoute = route;
};

/**
 * Creates an api endpoint. The endpoint is returned so that configuration of
 * the endpoint can be chained.
 *
 * @param {string} name The name of the endpoint.
 * @return {app.ApiEndpointConfig} The endpoint configuration object.
 */
app.ApiProvider.prototype.endpoint = function(name) {
  var endpointConfig = new app.ApiEndpointConfig();
  this.endpoints[name] = endpointConfig;
  return endpointConfig;
};

/**
 * Function invoked by angular to get the instance of the api service.
 * @return {Object.<string, app.ApiEndpoint>} The set of all api endpoints.
 */
app.ApiProvider.prototype.$get = ['$injector',
  function($injector) {
    var api = {};

    var self = this;
    angular.forEach(this.endpoints, function(endpointConfig, name) {
      api[name] = $injector.instantiate(app.ApiEndpoint, {
        baseRoute: self.baseRoute,
        endpointConfig: endpointConfig
      });
    });

    return api;
  }
];

/******************************************************************************/

// Example of creating an angular module to house "core" functionality. It is
// here that you add any custom providers.
app.core = angular.module('ngApiProvider', ['ngResource']);

app.core.config(function($provide) {
  $provide.provider('api', app.ApiProvider);
});
