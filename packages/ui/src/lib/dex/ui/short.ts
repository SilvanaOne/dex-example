export function shortenString(str: string | undefined, length = 6): string {
  if (!str) return ""
  if (str.length <= length * 2) return str
  return `${str.substring(0, length)}...${str.substring(str.length - length)}`
}

