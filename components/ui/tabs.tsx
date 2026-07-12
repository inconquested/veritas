"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  indicatorId: string;
  activeValue: string;
  setActiveValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const indicatorId = React.useId();

  // Track the active tab value in local state so children can safely read it
  const [activeValue, setActiveValue] = React.useState(
    value || defaultValue || "",
  );

  // Sync state if controlled from outside
  React.useEffect(() => {
    if (value !== undefined) {
      setActiveValue(value);
    }
  }, [value]);

  const handleValueChange = (newValue: string) => {
    setActiveValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ indicatorId, activeValue, setActiveValue }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        value={value !== undefined ? value : activeValue}
        onValueChange={handleValueChange}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const context = React.useContext(TabsContext);

  // Determine if this specific trigger is currently selected
  const isActive = context?.activeValue === value;

  return (
    <TabsPrimitive.Trigger asChild value={value} {...props}>
      <motion.button
        data-slot="tabs-trigger"
        whileTap={{ scale: 0.985 }}
        className={cn(
          "relative inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-transparent px-2 py-2 m-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors group-data-vertical/tabs:w-full hover:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          "data-[state=active]:text-foreground dark:data-[state=active]:text-foreground",
          "min-h-10",
          className,
        )}
      >
        <span className="relative z-10 inline-flex items-center gap-0.5">
          {children}
        </span>

        {/* The Sliding Background: Mounts and unmounts cleanly based on React lifecycle */}
        {isActive && context && (
          <motion.div
            layoutId={context.indicatorId}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 30,
              mass: 0.8,
            }}
            className="absolute inset-0 z-0 rounded-md bg-background px-2 shadow-sm dark:bg-input/30"
          />
        )}
      </motion.button>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  animated = false,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content> & {
  animated?: boolean;
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      data-animated={animated}
      className={cn(
        "flex-1 text-sm outline-none",
        animated &&
          "data-[state=inactive]:pointer-events-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-2 motion-reduce:data-[state=active]:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
