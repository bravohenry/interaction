"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "~/components/ui/item";

interface GmailAccount {
  id: string;
  email: string;
  avatarUrl?: string;
  isDefault: boolean;
}

interface GmailAccountsListProps {
  accounts: GmailAccount[];
  onItemClick?: (id: string) => void;
}

export function GmailAccountsList({
  accounts,
  onItemClick,
}: GmailAccountsListProps) {
  if (accounts.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No connected accounts
      </div>
    );
  }

  return (
    <ItemGroup>
      {accounts.map((account) => (
        <Item
          asChild
          key={account.id}
          onClick={() => onItemClick?.(account.id)}
        >
          <button type="button">
            <ItemMedia variant="image">
              <Avatar className="size-full rounded-sm">
                <AvatarImage alt={account.email} src={account.avatarUrl} />
                <AvatarFallback>
                  {account.email?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                <span className="truncate">{account.email}</span>
                {account.isDefault && (
                  <Badge
                    className="h-5 rounded-full px-2 text-foreground"
                    variant="secondary"
                  >
                    Primary
                  </Badge>
                )}
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <span aria-hidden className="text-muted-foreground">
                ›
              </span>
            </ItemActions>
          </button>
        </Item>
      ))}
    </ItemGroup>
  );
}
