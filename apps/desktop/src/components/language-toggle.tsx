"use client"

import * as React from "react"
import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function LanguageToggle() {
    const { i18n } = useTranslation()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-8 w-8 bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 backdrop-blur-md">
                    <Languages className="h-4 w-4" />
                    <span className="sr-only">Toggle language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card/50 backdrop-blur-md border-border/50">
                <DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>
                    <span>English</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("zh")}>
                    <span>中文</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
