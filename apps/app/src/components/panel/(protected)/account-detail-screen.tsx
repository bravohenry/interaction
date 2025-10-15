"use client";

import { Calendar, Contact, Mail, Star, Trash2 } from "lucide-react";
import { Screen } from "~/components/screen";
import { Badge } from "~/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "~/components/ui/item";

interface AccountDetailScreenProps {
  accountId: string;
  email: string;
  isDefault?: boolean;
  onMakePrimary?: () => void;
  onDelete?: () => void;
}

export function AccountDetailScreen({
  accountId: _accountId,
  email,
  isDefault = false,
  onMakePrimary,
  onDelete,
}: AccountDetailScreenProps) {
  return (
    <Screen headerType="back" title={email}>
      <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
        {/* Permissions Section */}
        <div className="flex w-full flex-col gap-3">
          <h2 className="text-left font-medium text-black text-sm">
            Permissions
          </h2>
          <ItemGroup>
            <Item asChild>
              <div>
                <ItemMedia
                  className="bg-transparent text-foreground"
                  variant="icon"
                >
                  <Mail className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Email</ItemTitle>
                  <div className="text-gray-400 text-xs">
                    Send and receive emails
                  </div>
                </ItemContent>
                <ItemActions>
                  <Badge
                    className="rounded-full text-muted-foreground"
                    variant="secondary"
                  >
                    Connected
                  </Badge>
                </ItemActions>
              </div>
            </Item>

            <Item asChild>
              <div>
                <ItemMedia
                  className="bg-transparent text-foreground"
                  variant="icon"
                >
                  <Calendar className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Calendar</ItemTitle>
                  <div className="text-gray-400 text-xs">
                    Create and respond to events
                  </div>
                </ItemContent>
                <ItemActions>
                  <Badge
                    className="rounded-full text-muted-foreground"
                    variant="secondary"
                  >
                    Connected
                  </Badge>
                </ItemActions>
              </div>
            </Item>

            <Item asChild>
              <div>
                <ItemMedia
                  className="bg-transparent text-foreground"
                  variant="icon"
                >
                  <Contact className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Contacts</ItemTitle>
                  <div className="text-gray-400 text-xs">
                    Access and search contacts
                  </div>
                </ItemContent>
                <ItemActions>
                  <Badge
                    className="rounded-full text-muted-foreground"
                    variant="secondary"
                  >
                    Connected
                  </Badge>
                </ItemActions>
              </div>
            </Item>
          </ItemGroup>
        </div>

        {/* Actions Section */}
        <div className="flex w-full flex-col gap-3">
          <h2 className="text-left font-medium text-black text-sm">Actions</h2>
          <ItemGroup>
            {!isDefault && (
              <Item asChild onClick={onMakePrimary}>
                <button type="button">
                  <ItemMedia
                    className="bg-transparent text-foreground"
                    variant="icon"
                  >
                    <Star className="size-4" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Make Primary</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <span aria-hidden className="text-muted-foreground">
                      ›
                    </span>
                  </ItemActions>
                </button>
              </Item>
            )}

            <Item asChild variant="destructive">
              <button onClick={onDelete} type="button">
                <ItemMedia className="bg-transparent" variant="icon">
                  <Trash2 className="size-4 text-destructive" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Delete Connection</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span aria-hidden className="text-muted-foreground">
                    ›
                  </span>
                </ItemActions>
              </button>
            </Item>
          </ItemGroup>
        </div>
      </div>
    </Screen>
  );
}
