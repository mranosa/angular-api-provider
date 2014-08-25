angular-api-provider
====================
About
----

Code is from [Jeremy Elbourn]. Added to bower because I think I will be re-using this a lot.

Version
----

0.0.1

Installation
--------------

```
bower install angular-api-provider
```

Usage
----

- Add module dependency 'ngApiProvider' : `angular.module('foo', ['ngApiProvider',..])`
- Initialize provider:

        .config(function(apiProvider) {
            apiProvider.setBaseRoute('my/app/api/');
 
          apiProvider.endpoint('songs').
              route('songs/:id').
              model(app.Song);
         
          apiProvider.endpoint('albums').
              route('albums/:id').
              model(app.Album);
        });


- Use in controller:

        app.SongController = function($scope, $routeParams, api) {
          var songs = api.songs.get({id: $routeParams.id});
        };

License
----

MIT


**Free Software, Hell Yeah!**

[Jeremy Elbourn]:https://gist.github.com/jelbourn/6276338
