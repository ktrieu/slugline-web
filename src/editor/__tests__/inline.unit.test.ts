import {
  LinkElement,
  InlineLatexElement,
  BlockElementType,
  InlineElementType,
} from "../types";
import createCustomEditor from "../CustomEditor";
import { createInline, unwrapInline } from "../helpers";

const TEST_LINK: LinkElement = {
  href: "www.test.com",
  type: InlineElementType.Link,
  children: [],
};

const TEST_LATEX_INLINE: InlineLatexElement = {
  latex: "\\LaTeX",
  type: InlineElementType.InlineLatex,
  children: [{ text: "" }],
};

describe("createInline", () => {
  it("wraps single text nodes", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "voodoo",
          },
        ],
      },
    ];
    editor.selection = {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 6 },
    };
    createInline(editor, TEST_LINK, undefined);

    // Slate will not allow an inline node to be the first/last child,
    // so we need these empty text nodes before and after it
    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "voodoo",
              },
            ],
          },
          {
            text: "",
          },
        ],
      },
    ]);
  });

  it("wraps partial text nodes", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "voodoo",
          },
        ],
      },
    ];
    editor.selection = {
      anchor: {
        path: [0, 0],
        offset: 1,
      },
      focus: {
        path: [0, 0],
        offset: 4,
      },
    };
    createInline(editor, TEST_LINK, undefined);

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "v",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "ood",
              },
            ],
          },
          {
            text: "oo",
          },
        ],
      },
    ]);
  });

  it("overwrites text if provided", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "voodoo",
          },
        ],
      },
    ];
    editor.selection = {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 6 },
    };

    createInline(editor, TEST_LINK, "overwritten");

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "overwritten",
              },
            ],
          },
          {
            text: "",
          },
        ],
      },
    ]);
  });

  it("does not create new inlines over existing ones", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "hahaha",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "voodoo",
              },
            ],
          },
          {
            text: "hehehe",
          },
        ],
      },
    ];

    editor.selection = {
      anchor: {
        path: [0, 0],
        offset: 0,
      },
      focus: {
        path: [0, 2],
        offset: 6,
      },
    };

    createInline(editor, TEST_LINK, undefined);

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "hahaha",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "voodoo",
              },
            ],
          },
          {
            text: "hehehe",
          },
        ],
      },
    ]);
  });

  it("creates new inlines from collapsed ranges", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "hahaha",
          },
        ],
      },
    ];

    editor.selection = {
      anchor: {
        path: [0, 0],
        offset: 0,
      },
      focus: {
        path: [0, 0],
        offset: 0,
      },
    };

    createInline(editor, TEST_LINK, "test-text");

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "test-text",
              },
            ],
          },
          {
            text: "hahaha",
          },
        ],
      },
    ]);
  });

  it("erases text when adding a void node", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "delete me",
          },
        ],
      },
    ];

    editor.selection = {
      anchor: {
        path: [0, 0],
        offset: 0,
      },
      focus: {
        path: [0, 0],
        offset: 6,
      },
    };

    createInline(editor, TEST_LATEX_INLINE);

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "",
          },
          {
            ...TEST_LATEX_INLINE,
            children: [
              {
                text: "",
              },
            ],
          },
          {
            text: " me",
          },
        ],
      },
    ]);
  });

  it("unhangs selections", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "first paragraph",
          },
        ],
      },
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "second paragraph",
          },
        ],
      },
    ];

    // this emulates a hanging selection
    editor.selection = {
      anchor: {
        path: [0, 0],
        offset: 0,
      },
      focus: {
        path: [1, 0],
        offset: 0,
      },
    };

    createInline(editor, TEST_LINK);

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "",
          },
          {
            ...TEST_LINK,
            children: [
              {
                text: "first paragraph",
              },
            ],
          },
          {
            text: "",
          },
        ],
      },
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "second paragraph",
          },
        ],
      },
    ]);
  });
});

describe("unwrapInline", () => {
  it("unwraps inlines", () => {
    const editor = createCustomEditor();

    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "",
          },
          {
            type: InlineElementType.Link,
            href: "google.com",
            children: [
              {
                text: "link text",
              },
            ],
          },
          {
            text: "",
          },
        ],
      },
    ];
    editor.selection = {
      anchor: {
        path: [0, 1, 0],
        offset: 2,
      },
      focus: {
        path: [0, 1, 0],
        offset: 2,
      },
    };

    unwrapInline(editor, InlineElementType.Link);

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "link text",
          },
        ],
      },
    ]);
  });

  it("leaves other inlines alone", () => {
    const editor = createCustomEditor();
    editor.children = [
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "some other text",
          },
          {
            type: InlineElementType.InlineLatex,
            latex: "3",
            children: [
              {
                text: "",
              },
            ],
          },
          {
            type: InlineElementType.Link,
            href: "google.com",
            children: [
              {
                text: "link text",
              },
            ],
          },
          {
            text: "",
          },
        ],
      },
    ];
    editor.selection = {
      anchor: {
        path: [0, 0],
        offset: 0,
      },
      focus: {
        path: [0, 2, 0],
        offset: 3,
      },
    };

    unwrapInline(editor, InlineElementType.Link);

    expect(editor.children).toEqual([
      {
        type: BlockElementType.Default,
        children: [
          {
            text: "some other text",
          },
          {
            type: InlineElementType.InlineLatex,
            latex: "3",
            children: [
              {
                text: "",
              },
            ],
          },
          {
            text: "link text",
          },
        ],
      },
    ]);
  });
});
