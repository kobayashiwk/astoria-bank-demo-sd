# Asteria Bank

Asteria Bank は、口座照会、振込、キャンペーン、プロフィール更新などの基本機能を備えたローカル開発用のWebアプリケーションです。

## 動作環境

- Windows 10 / 11
- Node.js 22.5 以上
- Docker不要

## 起動方法

```powershell
npm run reset
npm start
```

ブラウザで次のURLを開きます。

```text
http://localhost:3000
```

## 主な機能

- 利用者切り替え
- 口座一覧・口座詳細
- 口座間振込
- キャンペーン特典
- プロフィール更新

## データの初期化

```powershell
npm run reset
```

`data/asteria-bank.db` が再作成されます。

## 構成

```text
public/      Web画面
src/         サーバー処理
scripts/     初期化処理
docs/        仕様資料
terraform/   AWS構成例
```

## Terraform

`terraform/` にはAWS上の基本構成例を配置しています。

```powershell
cd terraform
terraform init
terraform validate
```

実環境へ適用する場合は、環境ごとの値を確認してから実行してください。
