import React from "react";

/** Put your file in `public/` and set the path (e.g. `/nuri-logo.png`, `/nuri-logo.jpg`). */
const LOGO_SRC = "/nuri-logo.png";

const Logo: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => (
  <img
    src={LOGO_SRC}
    alt="Nuri"
    width={40}
    height={40}
    className="h-10 w-10 shrink-0 object-contain"
    {...props}
  />
);

export default Logo;
