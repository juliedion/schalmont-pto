# V3.2 root-cause sky fix

Root cause:
Previous V3.0/V3.1 fixes targeted `.heroSky`, but the actual page uses `.hero__skyMotion`.
Those rules therefore never matched the live DOM.

This version:
- removes the accumulated V2.6/V2.8/V2.9/V3.0/V3.1 sky CSS
- leaves a single animation system
- targets the actual `.hero__skyMotion` wrapper
- keeps the Fort artwork and blink unchanged
- plane is 92x46px desktop / 66x33px mobile
- clouds remain 76–112px wide
- sun is 62px
- plane flies left-to-right while climbing with a short attached vapor trail
