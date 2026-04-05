import React from "react";
import ErrorState from "../../components/common/ErrorState";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class RouteErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  public static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "路由渲染失败",
    };
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="页面加载失败"
          message="详情页渲染异常，请刷新后重试。"
          technical={this.state.message}
        />
      );
    }

    return this.props.children;
  }
}
