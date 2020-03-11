# coordinate
Typescript coordinate class for handling coordinate input and output. If you improve it, please create pull request.

# Usage
Liberally accepts different coordinate types

```typescript
const coordinate = new Coordinate(37.499249, 116.391663);
const sameCoordinate = new Coordinate('37 29.9549 -116 23.4998');
const sameCoordinate2 = new Coordinate('N 37 29.9549 W 116 23.4998');
const sameCoordinate3 = new Coordinate('N 37 29.9549 -116 23.4998');

console.log(coordinate.degreesDecimalDegrees());
// N 37.499249 W 116.391663

console.log(coordinate.degreesMinutesDecimalMinutes());
// N 37 29.9549 W 116 23.4998

console.log(coordinate.degreesMinutesSecondsDecimalSeconds());
// N 37 29 57.3 W 116 29 29.99

console.log(coordinate.toFormat('D.D')); // Or `D M.M` or `D M S.S`
// N 37.499249 W 116.391663
```
