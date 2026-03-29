#!/usr/bin/env node
// Download all cargo.site images locally with browser-like headers
// Run: node download-images.mjs

import https from "https";
import fs from "fs";
import path from "path";

const DELAY = 6000; // 6 seconds between downloads
const BASE = "https://freight.cargo.site";

const IMAGES = [
  // Landing
  {
    dir: "landing",
    hash: "X2682094696207493612167657509731",
    file: "IGAC-exhibition-photography-048.jpg",
  },

  // Carnation-exe
  {
    dir: "carnation-exe",
    hash: "K2586476299518304130969389847395",
    file: "IMG_8458.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "Y2586477661662780021830100276067",
    file: "IMG_8498.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "X2586477713959299470796679107427",
    file: "IMG_8497.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "L2586478123126529769748243501923",
    file: "IMG_8478.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "A2586477290643416467309888623459",
    file: "IMG_8470.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "P2586477339139906637092299821923",
    file: "IMG_8474.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "O2586480870197210482500960605027",
    file: "IMG_8490.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "J2586480587851345690302563570531",
    file: "IMG_8481.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "K2586480654370304820099206697827",
    file: "IMG_8488.JPG",
  },
  {
    dir: "carnation-exe",
    hash: "U2586481015096385181489488548707",
    file: "IMG_8494.JPG",
  },

  // Versus-exe
  {
    dir: "versus-exe",
    hash: "L2651923156110863383776773624675",
    file: "IMG_9920.JPG",
  },
  {
    dir: "versus-exe",
    hash: "U2651930032743459413444553692003",
    file: "2831d8c8-b769-4e0d-ba6c-c1c838b4d131.JPG",
  },
  {
    dir: "versus-exe",
    hash: "L2651928450750687652113407103843",
    file: "IMG_1738.JPG",
  },
  {
    dir: "versus-exe",
    hash: "B2651928763902615047406755337059",
    file: "IMG_1718.JPG",
  },
  {
    dir: "versus-exe",
    hash: "H2651928886887057786828335960931",
    file: "IMG_1714.JPG",
  },
  {
    dir: "versus-exe",
    hash: "I2651929209520611636008393724771",
    file: "IMG_1700.JPG",
  },
  {
    dir: "versus-exe",
    hash: "S2651929377976278517124019082083",
    file: "IMG_1694.JPG",
  },
  {
    dir: "versus-exe",
    hash: "V2651929601753730875294589735779",
    file: "IMG_1685.JPG",
  },
  {
    dir: "versus-exe",
    hash: "D2651926755421120301910775386979",
    file: "IMG_9911.JPG",
  },
  {
    dir: "versus-exe",
    hash: "J2651926755642481230795290006371",
    file: "IMG_9912.JPG",
  },
  {
    dir: "versus-exe",
    hash: "L2651926755660927974868999557987",
    file: "IMG_9913.JPG",
  },
  {
    dir: "versus-exe",
    hash: "Z2651926755679374718942709109603",
    file: "IMG_9915.JPG",
  },
  {
    dir: "versus-exe",
    hash: "U2651926755697821463016418661219",
    file: "IMG_9916.JPG",
  },
  {
    dir: "versus-exe",
    hash: "K2651927273940649469812561761123",
    file: "IMG_9917.JPG",
  },
  {
    dir: "versus-exe",
    hash: "U2651927538264045301996726866787",
    file: "IMG_9921.jpg",
  },
  {
    dir: "versus-exe",
    hash: "K2651927964715874798014141125475",
    file: "IMG_9940.jpg",
  },
  {
    dir: "versus-exe",
    hash: "G2651928122656897557115322061667",
    file: "IMG_9925.jpg",
  },

  // Reinforcement-exe
  {
    dir: "reinforcement-exe",
    hash: "Z2682094116426327375476450218851",
    file: "_MG_5037.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "U2682094274422690366798759809891",
    file: "_MG_5036.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "A2682094523859563731499316761443",
    file: "DSC01755.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "C2682095106020359953699056210787",
    file: "IGAC-exhibition-photography-049.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "Y2682096433946125587828548391779",
    file: "L1002255.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "G2682096571245241728448741069667",
    file: "L1001674.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "V2682096736011559794822456103779",
    file: "L1002259.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "O2682097520570031993763395883875",
    file: "Untitled-2-01.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "Y2682097520754499434500491400035",
    file: "Untitled-2-02.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "O2682097520772946178574200951651",
    file: "Untitled-2-03.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "O2682097520791392922647910503267",
    file: "Untitled-2-04.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "U2682097520809839666721620054883",
    file: "Untitled-2-05.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "J2682097520828286410795329606499",
    file: "Untitled-2-06.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "C2682097520846733154869039158115",
    file: "Untitled-2-07.jpg",
  },
  {
    dir: "reinforcement-exe",
    hash: "L2682097520865179898942748709731",
    file: "Untitled-2-08.jpg",
  },
];

function download(img) {
  return new Promise((resolve) => {
    const url = `${BASE}/w/1600/i/${img.hash}/${img.file}`;
    const destDir = path.join("public", "images", img.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, img.file);

    const options = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://cargo.site/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-site",
      },
    };

    https
      .get(url, options, (res) => {
        // Follow redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          https
            .get(res.headers.location, options, (res2) => {
              const chunks = [];
              res2.on("data", (c) => chunks.push(c));
              res2.on("end", () => {
                const buf = Buffer.concat(chunks);
                fs.writeFileSync(dest, buf);
                const ok = buf.length > 10000;
                console.log(
                  `  ${ok ? "OK" : "FAIL"} (${buf.length} bytes) ${dest}`,
                );
                resolve(ok);
              });
            })
            .on("error", (e) => {
              console.log(`  ERROR ${dest}: ${e.message}`);
              resolve(false);
            });
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(dest, buf);
          const ok = buf.length > 10000;
          console.log(`  ${ok ? "OK" : "FAIL"} (${buf.length} bytes) ${dest}`);
          resolve(ok);
        });
      })
      .on("error", (e) => {
        console.log(`  ERROR ${dest}: ${e.message}`);
        resolve(false);
      });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < IMAGES.length; i++) {
    const img = IMAGES[i];
    process.stdout.write(
      `[${i + 1}/${IMAGES.length}] ${img.dir}/${img.file} ... `,
    );
    const success = await download(img);
    if (success) ok++;
    else fail++;
    if (i < IMAGES.length - 1) await sleep(DELAY);
  }

  console.log(`\n=== Done: ${ok} OK, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Some downloads failed. The CDN may be rate-limiting.");
    console.log("Try again in a few minutes, or increase the DELAY.");
  }
}

main();
