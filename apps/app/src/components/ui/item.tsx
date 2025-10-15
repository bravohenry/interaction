import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "~/lib/utils";

function ItemGroup({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "group/item-group flex w-full flex-col gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50",
        className
      )}
      data-slot="item-group"
      {...props}
    />
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("h-px bg-gray-200", className)}
      data-slot="item-separator"
      {...props}
    />
  );
}

const itemVariants = cva(
  "group/item inline-flex w-full items-center justify-start gap-3 whitespace-nowrap rounded-none px-4 py-4 text-left font-normal text-sm outline-none transition-colors hover:bg-gray-100 focus-visible:bg-gray-200/60 focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        destructive:
          "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 active:bg-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Item({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(itemVariants({ variant, className }))}
      data-slot="item"
      data-variant={variant}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center [&_svg:not([class*='size-'])]:size-5 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      className={cn(itemMediaVariants({ variant, className }))}
      data-slot="item-media"
      data-variant={variant}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="item-content"
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 font-medium text-sm leading-tight",
        className
      )}
      data-slot="item-title"
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "line-clamp-2 text-balance font-normal text-muted-foreground text-xs leading-normal",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      data-slot="item-description"
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-2", className)}
      data-slot="item-actions"
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-2",
        className
      )}
      data-slot="item-header"
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-2",
        className
      )}
      data-slot="item-footer"
      {...props}
    />
  );
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
};
