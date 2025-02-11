import React from 'react';
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import {
  clone,
  ComponentPropType,
  SetterOnChangeDetailType,
  useBoolean,
} from '@music163/tango-helpers';
import { isWrappedByExpressionContainer } from '@music163/tango-core';
import { ToggleButton, CodeOutlined } from '@music163/tango-ui';
import { InputProps } from 'antd';
import { useFormModel, useFormVariable } from './context';
import { FormControl } from './form-ui';
import { Box, Text } from 'coral-system';

export interface FormItemProps extends ComponentPropType {
  extra?: React.ReactNode;
  footer?: React.ReactNode;
}

export interface FormItemComponentProps<T = any> {
  value?: T;
  onChange: (value: T, detail?: SetterOnChangeDetailType) => void;
  readOnly?: boolean;
  disabled?: boolean;
  status?: InputProps['status'];
  [prop: string]: any;
}

export interface IFormItemCreateOptions {
  /**
   * 设置器调用名
   */
  name: string;
  /**
   * 别名列表
   */
  alias?: string[];
  /**
   * 渲染的组件
   */
  component?: React.ComponentType<FormItemComponentProps>;
  /**
   * 自定义渲染器
   */
  render?: (args: FormItemComponentProps) => React.ReactElement;
  /**
   * 是否禁用变量设置器
   */
  disableVariableSetter?: boolean;
  /**
   * 默认的表单值校验逻辑
   */
  validate?: (value: string) => string | Promise<any>;
}

const defaultGetSetterProps = () => ({});
const defaultGetVisible = () => true;

export function createFormItem(options: IFormItemCreateOptions) {
  const renderSetter =
    options.render ?? ((props: any) => React.createElement(options.component, props));

  function FormItem({
    name,
    title,
    tip,
    placeholder,
    docs,
    autoCompleteOptions,
    setter,
    setterProps,
    defaultValue,
    options: setterOptions,
    disableVariableSetter: disableVariableSetterProp = options.disableVariableSetter,
    getVisible: getVisibleProp,
    getSetterProps: getSetterPropsProp,
    extra,
    footer,
  }: FormItemProps) {
    const { disableSwitchExpressionSetter, showItemSubtitle } = useFormVariable();
    const model = useFormModel();
    const field = model.getField(name);
    const value = toJS(field.value ?? defaultValue);
    const disableVariableSetter = disableSwitchExpressionSetter ?? disableVariableSetterProp;
    const [isVariable, { toggle: toggleIsVariable }] = useBoolean(
      () => !disableVariableSetter && isWrappedByExpressionContainer(value),
    );

    const setterName = isVariable ? 'expressionSetter' : setter;

    field.setConfig({
      validate: options.validate,
    });

    const baseComponentProps = clone(
      {
        value,
        defaultValue,
        onChange: field.handleChange,
        status: field.error ? 'error' : undefined,
        placeholder,
        options: setterOptions,
      },
      false,
    ) as FormItemComponentProps;

    let expProps = {};

    // FIXME: 重新考虑这段代码的位置，外置这个逻辑
    if (
      ['expressionSetter', 'expSetter', 'actionSetter', 'eventSetter'].includes(setter) ||
      isVariable
    ) {
      expProps = {
        modalTitle: title,
        modalTip: tip,
        autoCompleteOptions,
      };
    }

    const getSetterProps = getSetterPropsProp || defaultGetSetterProps;
    // 从注册表中获取 expSetter
    const ExpressionSetter = REGISTERED_FORM_ITEM_MAP['expressionSetter']?.config?.component;

    const setterNode = isVariable ? (
      <ExpressionSetter {...expProps} {...baseComponentProps} />
    ) : (
      renderSetter({
        ...expProps,
        ...baseComponentProps,
        ...setterProps, // setterProps 优先级大于快捷属性
        ...getSetterProps(model),
      })
    );

    const getVisible = getVisibleProp || defaultGetVisible;

    return (
      <FormControl
        visible={getVisible(model)}
        label={title}
        note={showItemSubtitle ? name : null}
        tip={tip}
        docs={docs}
        error={field.error}
        extra={
          <Box>
            {extra}
            {!disableVariableSetter ? (
              <ToggleButton
                borderRadius="s"
                size="s"
                shape="outline"
                type="primary"
                tooltip={isVariable ? '关闭 JS 表达式' : '使用 JS 表达式'}
                tooltipPlacement="left"
                selected={isVariable}
                onClick={() => toggleIsVariable()}
              >
                <CodeOutlined />
              </ToggleButton>
            ) : null}
          </Box>
        }
        footer={footer}
        data-setter={setterName}
        data-field={name}
      >
        {setterNode}
      </FormControl>
    );
  }

  FormItem.displayName = `FormItem_${options.name}`;
  FormItem.config = options;

  return observer(FormItem);
}

// 已注册的 setter 查找表
const REGISTERED_FORM_ITEM_MAP: Record<string, ReturnType<typeof createFormItem>> = {};

/**
 * Setter 注册
 * @param config 注册选项
 */
export function register(config: IFormItemCreateOptions) {
  const names = [config.name, ...(config.alias ?? [])];
  names.forEach((name) => {
    REGISTERED_FORM_ITEM_MAP[name] = createFormItem(config);
  });
}

export function SettingFormItem(props: FormItemProps) {
  const { setter } = props;
  const Comp = REGISTERED_FORM_ITEM_MAP[setter];
  if (Comp == null) {
    const Fallback = REGISTERED_FORM_ITEM_MAP.expressionSetter;
    return (
      <Fallback
        {...props}
        footer={
          <Text color="red" mt="m">
            {props.setter} is invalid
          </Text>
        }
      />
    );
  }
  return React.createElement(Comp, props);
}
