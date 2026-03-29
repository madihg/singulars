#!/bin/bash
# Download all cargo.site images locally
# Run from the singulars project root: ./download-images.sh
set -e

cd "$(dirname "$0")"

mkdir -p public/images/landing
mkdir -p public/images/carnation-exe
mkdir -p public/images/versus-exe
mkdir -p public/images/reinforcement-exe

BASE="https://freight.cargo.site/i"
DELAY=5

download() {
  local dir="$1" hash="$2" file="$3"
  local url="${BASE}/${hash}/${file}"
  local dest="public/images/${dir}/${file}"
  printf "  %-60s" "${dest}"
  curl -s -o "${dest}" "${url}"
  local size
  size=$(wc -c < "${dest}" | tr -d ' ')
  if [ "$size" -lt 10000 ]; then
    echo "FAILED (${size} bytes)"
  else
    echo "OK (${size} bytes)"
  fi
  sleep $DELAY
}

echo "Downloading landing images..."
download landing X2682094696207493612167657509731 IGAC-exhibition-photography-048.jpg

echo "Downloading carnation-exe images..."
download carnation-exe K2586476299518304130969389847395 IMG_8458.JPG
download carnation-exe Y2586477661662780021830100276067 IMG_8498.JPG
download carnation-exe X2586477713959299470796679107427 IMG_8497.JPG
download carnation-exe L2586478123126529769748243501923 IMG_8478.JPG
download carnation-exe A2586477290643416467309888623459 IMG_8470.JPG
download carnation-exe P2586477339139906637092299821923 IMG_8474.JPG
download carnation-exe O2586480870197210482500960605027 IMG_8490.JPG
download carnation-exe J2586480587851345690302563570531 IMG_8481.JPG
download carnation-exe K2586480654370304820099206697827 IMG_8488.JPG
download carnation-exe U2586481015096385181489488548707 IMG_8494.JPG

echo "Downloading versus-exe images..."
download versus-exe L2651923156110863383776773624675 IMG_9920.JPG
download versus-exe U2651930032743459413444553692003 2831d8c8-b769-4e0d-ba6c-c1c838b4d131.JPG
download versus-exe L2651928450750687652113407103843 IMG_1738.JPG
download versus-exe B2651928763902615047406755337059 IMG_1718.JPG
download versus-exe H2651928886887057786828335960931 IMG_1714.JPG
download versus-exe I2651929209520611636008393724771 IMG_1700.JPG
download versus-exe S2651929377976278517124019082083 IMG_1694.JPG
download versus-exe V2651929601753730875294589735779 IMG_1685.JPG
download versus-exe D2651926755421120301910775386979 IMG_9911.JPG
download versus-exe J2651926755642481230795290006371 IMG_9912.JPG
download versus-exe L2651926755660927974868999557987 IMG_9913.JPG
download versus-exe Z2651926755679374718942709109603 IMG_9915.JPG
download versus-exe U2651926755697821463016418661219 IMG_9916.JPG
download versus-exe K2651927273940649469812561761123 IMG_9917.JPG
download versus-exe U2651927538264045301996726866787 IMG_9921.jpg
download versus-exe K2651927964715874798014141125475 IMG_9940.jpg
download versus-exe G2651928122656897557115322061667 IMG_9925.jpg

echo "Downloading reinforcement-exe images..."
download reinforcement-exe Z2682094116426327375476450218851 _MG_5037.jpg
download reinforcement-exe U2682094274422690366798759809891 _MG_5036.jpg
download reinforcement-exe A2682094523859563731499316761443 DSC01755.jpg
download reinforcement-exe C2682095106020359953699056210787 IGAC-exhibition-photography-049.jpg
download reinforcement-exe Y2682096433946125587828548391779 L1002255.jpg
download reinforcement-exe G2682096571245241728448741069667 L1001674.jpg
download reinforcement-exe V2682096736011559794822456103779 L1002259.jpg
download reinforcement-exe O2682097520570031993763395883875 Untitled-2-01.jpg
download reinforcement-exe Y2682097520754499434500491400035 Untitled-2-02.jpg
download reinforcement-exe O2682097520772946178574200951651 Untitled-2-03.jpg
download reinforcement-exe O2682097520791392922647910503267 Untitled-2-04.jpg
download reinforcement-exe U2682097520809839666721620054883 Untitled-2-05.jpg
download reinforcement-exe J2682097520828286410795329606499 Untitled-2-06.jpg
download reinforcement-exe C2682097520846733154869039158115 Untitled-2-07.jpg
download reinforcement-exe L2682097520865179898942748709731 Untitled-2-08.jpg

echo ""
echo "=== Summary ==="
total=$(find public/images -name "*.jpg" -o -name "*.JPG" 2>/dev/null | wc -l | tr -d ' ')
failed=0
find public/images \( -name "*.jpg" -o -name "*.JPG" \) -print0 2>/dev/null | while IFS= read -r -d '' f; do
  size=$(wc -c < "$f" | tr -d ' ')
  if [ "$size" -lt 10000 ]; then
    echo "FAILED: $f ($size bytes)"
    failed=$((failed + 1))
  fi
done
echo "Total: ${total} files downloaded"
echo "Done! If downloads failed, increase DELAY at the top of this script and re-run."
