import React from "react";
import {
  Button as BsButton,
  ButtonProps as BsButtonProps,
} from "react-bootstrap";
import { Link, LinkProps } from "react-router-dom";

import "./styles/Button.scss";

export interface ButtonProps {
  variant:
    | "dark"
    | "light"
    | "pink-dark"
    | "pink-light"
    | "grey-dark"
    | "grey-light";
}

const Button = React.forwardRef<
  BsButton & HTMLButtonElement, // TODO: remove dependency on BsButton once we upgrade react-bootstrap
  ButtonProps & Omit<BsButtonProps, "variant"> & JSX.IntrinsicElements["button"]
>(({ variant, className, children, ...props }, ref) => {
  return (
    <BsButton
      ref={ref}
      variant="primary"
      {...(props as BsButtonProps)}
      className={`Button Button-${variant} ${className || ""}`}
    >
      {children}
    </BsButton>
  );
});

export const LinkButton = React.forwardRef<
  HTMLAnchorElement,
  ButtonProps & LinkProps
>(({ variant, className, children, ...props }, ref) => {
  return (
    <Link
      ref={ref as React.Ref<Link>}
      {...(props as LinkProps)}
      className={`btn btn-primary Button Button-${variant} ${className || ""}`}
    >
      {children}
    </Link>
  );
});

export default Button;
