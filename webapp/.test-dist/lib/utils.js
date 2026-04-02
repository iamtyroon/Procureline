"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.se = exports.fr = exports.cn = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = require("clsx");
const react_1 = require("react");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
exports.cn = cn;
// forward refs
function fr(component) {
    const wrapped = (0, react_1.forwardRef)(component);
    wrapped.displayName = component.name;
    return wrapped;
}
exports.fr = fr;
// styled element
function se(Tag, ...classNames) {
    const component = fr(({ className, ...props }, ref) => (
    // @ts-expect-error Too complicated for TypeScript
    (0, jsx_runtime_1.jsx)(Tag, { ref: ref, className: cn(...classNames, className), ...props })));
    component.displayName = Tag[0].toUpperCase() + Tag.slice(1);
    return component;
}
exports.se = se;
