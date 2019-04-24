const areaPolygon = require('area-polygon');
const hull = require('hull.js');

class TimeHull {
  constructor({
    seriesPoints,
    pointTrailLength,
    startIndex = 0,
    endIndex,
    width = 0,
    height = 0,
  }) {
    if(typeof(seriesPoints) == 'undefined' || !seriesPoints.length) {
      throw new Error('noSeriesPoints');
    }

    if(!endIndex) {
      endIndex = seriesPoints.length - 1;
    }

    this.width = width;
    this.height = height;
    this.seriesPoints = seriesPoints;
    this.pointTrailLength = pointTrailLength;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.points = this.getSlicedPoints();

    this.duration = () => {
      if(seriesPoints[this.endIndex + 1]) {
        return (seriesPoints[this.endIndex + 1].timestamp - this.endTime());
      } else {
        return 0;
      }
    }
  }

  area({
    points = this.points,
  }) {
    let perimeterPoints = this.distinctPoints(this.polygon({ points: points }));
    if(perimeterPoints.length < 3) return 0;
    return areaPolygon(perimeterPoints);
  }

  azimuth() {
    let azimuth;
    if(this.points && this.points.length > 1) {
      let start = this.points[this.points.length - 2];
      let end = this.points[this.points.length - 1];

      if(start.x == end.x && start.y == end.y) {
        azimuth = 0;
      } else {
        azimuth = 90 - Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;

        if(azimuth < 0) {
          azimuth = azimuth + 360;
        }
      }
    }

    return azimuth;
  }

  calculateCentroid(points) {
    let pts = points.slice();
    if(pts.length == 1) {
      return { x: pts[0].x, y: pts[0].y }
    } else {
      // https://stackoverflow.com/questions/9692448/how-can-you-find-the-centroid-of-a-concave-irregular-polygon-in-javascript
      var first = pts[0], last = pts[pts.length-1];
      if (first.x != last.x || first.y != last.y) pts.push(first);
      var twicearea=0,
      x=0, y=0,
      nPts = pts.length,
      p1, p2, f;
      for ( var i=0, j=nPts-1 ; i<nPts ; j=i++ ) {
        p1 = pts[i]; p2 = pts[j];
        f = p1.x*p2.y - p2.x*p1.y;
        twicearea += f;
        x += ( p1.x + p2.x ) * f;
        y += ( p1.y + p2.y ) * f;
      }
      f = twicearea * 3;
      return { x:x/f, y:y/f };
    }
  }

  centroid({
    points = this.points,
    which,
  }) {
    let centroid;

    if(points.length == 1) centroid = { x: points[0].x, y: points[0].y };
    if(points.length == 2) {
      centroid = {
        x: (points[0].x + points[1].x)/2,
        y: (points[0].y + points[1].y)/2,
      };
    }

    if(points.length > 2) {
      let perimeterPoints = this.distinctPoints(this.polygon({ points: points }));
      centroid = this.calculateCentroid(perimeterPoints);
    }

    if(typeof(which) != 'undefined') {
      return centroid[which];
    } else {
      return centroid;
    }
  }

  coordinatesToXY(points) {
    return points.map(function(point) {
      return { x: point[0], y: point[1] };
    });
  }

  coverage({
    points = this.points,
    width = this.width,
    height = this.height,
  }) {
    let area = this.area({ points: points });
    if(area == 0) return 0;
    if(width * height == 0) throw new Error('noStimulusArea');
    return area / (width * height);
  }

  coverageDuration({
    points = this.points,
  }) {
    return (this.coverage({}) * this.duration());
  }

  coveragePercent({
    points = this.points,
  }) {
    return (this.coverage({ points: points }) * 100);
  }

  distance(which) {
    if(typeof(which) != 'undefined') {
      if(this.points && this.points.length > 1) {
        return (this.points[this.points.length - 1][which] - this.points[this.points.length - 2][which]);
      } else {
        return 0;
      }
    } else {
      return Math.sqrt((this.distance('x') * this.distance('x') + this.distance('y') * this.distance('y')));
    }
  }

  distinctPoints(points) {
    let distinct = []
    for (let i = 0; i < points.length; i++) {
      if(distinct.findIndex((e) => (e.x == points[i].x && e.y == points[i].y)) < 0) {
        distinct.push(points[i]);
      }
    }
    return distinct;
  }

  endTime() {
    return this.points[this.points.length - 1].timestamp;
  }

  pointTrail(length, which) {
    if(length < 0) throw new Error('invalidTrailLength');

    let trailStart = Math.max((this.endIndex + 1 - length), 0);
    let trailEnd = (this.endIndex + 1);
    let trail = this.seriesPoints.slice(trailStart, trailEnd);
    if(typeof(which) != 'undefined') {
      return trail.map((point) => {
        return point[which];
      });
    } else {
      return trail;
    }
  }
  
  getSlicedPoints(which) {
    let points = this.seriesPoints.slice(this.startIndex, this.endIndex + 1);
    if(typeof(which) != 'undefined') {
      return points.map((point) => { return point[which]; });
    } else {
      return points;
    }
  }

  lastPoint() {
    return this.points[this.points.length - 1];
  }

  period() {
    return (this.endTime() - this.startTime());
  }

  polygon({
    points = this.points,
    which,
  }) {
    let hullPoints = hull(this.XYToCoordinates(points), Infinity);

    hullPoints = this.coordinatesToXY(hullPoints);

    if(typeof(which) != 'undefined') {
      return hullPoints.map((point) => { return point[which]; });
    } else {
      return hullPoints;
    }
  }

  startTime() {
    return this.points[0].timestamp;
  }

  timeStep() {
    if(this.points && this.points.length > 1) {
      return (this.points[this.points.length - 1].timestamp -
              this.points[this.points.length - 2].timestamp);
    } else {
      return 0;
    }
  }

  velocity(which) {
    if(this.timeStep() > 0 && this.distance() > 0) {
      return (this.distance(which) / this.timeStep());
    } else {
      return 0;
    }
  }

  XYToCoordinates(points) {
    return points.map(function(point) {
      return [point.x, point.y];
    });
  }
}

module.exports = TimeHull;