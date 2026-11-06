# Ahri W rendering preparation

This branch starts from the verified schema 178 W visual history. The primary
work branch still runs the accepted Q projectile renderer. W particle assets
remain private and W source rendering is not yet connected to the scene.

The history adapter dispatches only orbit, flight and genuine hit groups. Cast
and weapon resources remain unjoined. Orbit placement ends at the saved dispatch
anchor; flight begins from that anchor and follows actual moved samples. Impact
placement retains the terminal heading. Enemy unbound samples require visibility
at both interpolation neighbours; an exact visible sample can enter sight.

Phase paths cache cumulative source-unit distance between immutable history
updates. Binary searches support seeks in either direction, and weak fire keys
release replaced histories. New samples, dispatch/end anchors and refreshed birth
visibility invalidate the cached path. Five focused adapter tests and TypeScript
checking pass. These are placement preparations, not visual acceptance.
