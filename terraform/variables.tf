variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "project_name" {
  type    = string
  default = "asteria-bank"
}

variable "office_cidr" {
  type        = string
  description = "運用拠点の接続元CIDR"
  default     = "203.0.113.0/24"
}

variable "db_username" {
  type    = string
  default = "asteria"
}

variable "db_password" {
  type      = string
  sensitive = true
}
