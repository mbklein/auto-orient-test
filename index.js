const fs = require('fs');
const https = require('https');
const path = require('path');
const sharp = require('sharp');

const ensureDirectoryExists = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
};

const get = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      } else {
        resolve(response);
      }
    }).on('error', reject);
  });
}

const transform = async (frame, orientation, crop, rotate, autoOrient) => {
  const url = `https://raw.githubusercontent.com/recurser/exif-orientation-examples/refs/heads/master/${frame}_${orientation}.jpg`;
  const pipeline = sharp({ limitInputPixels: false });
  const response = await get(url);

  const dims = [1800, 1200];

  if (frame === 'Portrait') {
    dims.reverse();
  }
  if (!autoOrient) {
    if (orientation > 4) {
      dims.reverse();
    }
  }

  if (autoOrient) {
    pipeline.autoOrient();
  }

  const rotation = rotate ? 45 : 0;
  const region = {
    left: crop ? dims[0] / 3 : 0,
    top: crop ? dims[1] / 3 : 0,
    width: crop ? dims[0] / 3 : dims[0],
    height: crop ? dims[1] / 3 : dims[1],
  };

  pipeline.extract(region).rotate(rotation);
    
  response.pipe(pipeline);
  const buffer = await pipeline.toBuffer();

  const ext = path.extname(url);
  const fileName = [
    frame,
    orientation,
    autoOrient ? 'auto' : 'noauto',
    crop ? 'crop' : 'full',
    rotate ? '45' : '0',
  ].join('-') + ext;
  const outputFile = path.join('output', fileName);
  fs.writeFileSync(outputFile, buffer);
}

ensureDirectoryExists('output');
const promises = [];

for (const frame of ['Landscape', 'Portrait']) {
  for (let orientation = 1; orientation <= 8; orientation++) {
    for (const crop of [false, true]) {
      for (const rotate of [false, true]) {
        for (const autoOrient of [false, true]) {
          console.log('frame: %s, orientation: %d, crop: %s, rotate: %s, autoOrient: %s', frame, orientation, crop, rotate, autoOrient);
          promises.push(transform(frame, orientation, crop, rotate, autoOrient));
        }
      }
    }
  }
}

Promise.all(promises)
  .then(() => console.log('Image processing complete.'))
  .catch(err => console.error('Error processing images:', err));
