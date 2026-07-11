"use client"

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "../lib/utils"
import { spring } from "../lib/springs"
import type { HTMLAttributes, ReactNode } from "react"

interface TabsSubtleContextValue {
  registerTab: (index: number, element: HTMLElement | null) => void
  selectedIndex: number
  idPrefix: string | undefined
}

const TabsSubtleContext = createContext<TabsSubtleContextValue | null>(null)

function useTabsSubtle() {
  const ctx = useContext(TabsSubtleContext)
  if (!ctx) {
    throw new Error("useTabsSubtle must be used within a TabsSubtle")
  }
  return ctx
}

interface TabsSubtleProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  children: ReactNode
  selectedIndex: number
  onSelect: (index: number) => void
  idPrefix?: string
}

const TabsSubtle = forwardRef<HTMLDivElement, TabsSubtleProps>(
  (
    { children, selectedIndex, onSelect, idPrefix, className, ...props },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const observerRef = useRef<ResizeObserver | null>(null)
    const [rects, setRects] = useState<
      Array<{ left: number; top: number; width: number; height: number }>
    >([])
    const tabElementsRef = useRef(new Map<number, HTMLElement>())

    const measureTabs = useCallback(() => {
      const container = containerRef.current
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      const next: Array<{
        left: number
        top: number
        width: number
        height: number
      }> = []
      tabElementsRef.current.forEach((element, index) => {
        const rect = element.getBoundingClientRect()
        next[index] = {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        }
      })
      setRects(next)
    }, [])

    const registerTab = useCallback(
      (index: number, element: HTMLElement | null) => {
        if (element) {
          tabElementsRef.current.set(index, element)
          observerRef.current?.observe(element)
        } else {
          const previous = tabElementsRef.current.get(index)
          if (previous) {
            observerRef.current?.unobserve(previous)
          }
          tabElementsRef.current.delete(index)
        }
        measureTabs()
      },
      [measureTabs]
    )

    useEffect(() => {
      measureTabs()
      const container = containerRef.current
      if (!container) return
      const observer = new ResizeObserver(() => measureTabs())
      observerRef.current = observer
      observer.observe(container)
      tabElementsRef.current.forEach((element) => observer.observe(element))
      return () => {
        observer.disconnect()
        observerRef.current = null
      }
    }, [measureTabs])

    const selectedRect =
      selectedIndex >= 0 && selectedIndex < rects.length
        ? rects[selectedIndex]
        : undefined

    return (
      <TabsSubtleContext.Provider
        value={{ registerTab, selectedIndex, idPrefix }}
      >
        <TabsPrimitive.Root
          value={selectedIndex}
          onValueChange={(value) => {
            if (typeof value === "number") onSelect(value)
          }}
          className={cn("w-full", className)}
          {...props}
        >
          <TabsPrimitive.List
            activateOnFocus={false}
            ref={(node) => {
              containerRef.current = node
              if (typeof ref === "function") ref(node)
              else if (ref) ref.current = node
            }}
            className="relative flex w-full items-center gap-0.5 rounded-lg bg-muted p-[3px]"
          >
            <AnimatePresence initial={false}>
              {selectedRect ? (
                <motion.div
                  key="selected-pill"
                  className="pointer-events-none absolute rounded-md bg-background shadow-sm"
                  initial={false}
                  animate={{
                    left: selectedRect.left,
                    width: selectedRect.width,
                    top: selectedRect.top,
                    height: selectedRect.height,
                  }}
                  transition={spring.moderate}
                />
              ) : null}
            </AnimatePresence>
            {children}
          </TabsPrimitive.List>
        </TabsPrimitive.Root>
      </TabsSubtleContext.Provider>
    )
  }
)

TabsSubtle.displayName = "TabsSubtle"

interface TabsSubtleItemProps extends HTMLAttributes<HTMLButtonElement> {
  label: string
  index: number
}

const TabsSubtleItem = forwardRef<HTMLButtonElement, TabsSubtleItemProps>(
  ({ label, index, className, ...props }, ref) => {
    const internalRef = useRef<HTMLButtonElement | null>(null)
    const { registerTab, selectedIndex, idPrefix } = useTabsSubtle()
    const isSelected = selectedIndex === index

    useEffect(() => {
      registerTab(index, internalRef.current)
      return () => registerTab(index, null)
    }, [index, registerTab, label])

    return (
      <TabsPrimitive.Tab
        ref={(node) => {
          const button = node as HTMLButtonElement | null
          internalRef.current = button
          if (typeof ref === "function") ref(button)
          else if (ref) ref.current = button
        }}
        value={index}
        id={idPrefix ? `${idPrefix}-tab-${index}` : undefined}
        aria-controls={idPrefix ? `${idPrefix}-panel-${index}` : undefined}
        className={cn(
          "relative z-10 flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md border-none bg-transparent px-2 text-xs outline-none",
          isSelected
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        {...props}
      >
        <span className="truncate tabular-nums">{label}</span>
      </TabsPrimitive.Tab>
    )
  }
)

TabsSubtleItem.displayName = "TabsSubtleItem"

export { TabsSubtle, TabsSubtleItem }
