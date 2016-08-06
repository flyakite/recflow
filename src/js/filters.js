angular
  .module('Filters', [])
  .filter('rawHTML', ['$sce', function($sce){
    return function(val) {
      return $sce.trustAsHtml(val);
    };
  }])
  // .filter('cssClip', [function(){
  //   return function(val) {
  //     if(val && typeof val.rect !== 'undefined'){
  //       console.log(val);
  //       const r = val.rect;
  //       return `clip:rect(${r.top}px,${r.right}px,${r.bottom}px,${r.left}px);
  //         top:-${r.top}px;left:-${r.left}px;`;
  //     }
  //     return '';
  //   };
  // }])
  .filter('cssClip', [function(){
    return function(val) {
        console.log(val);
      if(val && typeof val.margin !== 'undefined'){
        const m = val.margin;
        return `margin-top:-${m.top}px;margin-left:-${m.left}px;
          width:${val.width}px;height:${val.height}px;`;
      }
      return '';
    };
  }])
;