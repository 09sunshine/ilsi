/**
 * Global DOM patch to prevent Google Translate, Chrome automatic translation,
 * and browser extensions from crashing React with:
 * "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
 * "NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node."
 *
 * Background:
 * Google Translate and several translation extensions modify the DOM directly by wrapping
 * text nodes in `<font>` tags or re-parenting elements outside React's virtual DOM tree.
 * When React subsequently performs reconciliation (on state updates, route changes, or unmounting),
 * it calls parentNode.removeChild(child) or parentNode.insertBefore(newNode, refNode).
 * Since the parent is no longer the expected node, the browser throws an unhandled DOMException,
 * crashing the entire page.
 *
 * This patch intercepts removeChild and insertBefore and handles foreign or re-parented nodes
 * gracefully without throwing.
 */

if (typeof window !== "undefined" && typeof Node !== "undefined" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console && typeof console.warn === "function") {
        console.warn(
          "[DOM Patch] Safe removeChild: node was re-parented or already detached outside React.",
          child
        );
      }
      if (child.parentNode) {
        return child.parentNode.removeChild(child) as T;
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && typeof console.warn === "function") {
        console.warn(
          "[DOM Patch] Safe insertBefore: referenceNode was re-parented or detached outside React.",
          referenceNode
        );
      }
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode) as T;
      }
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

export {};
